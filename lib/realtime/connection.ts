import { getRealtimeUrl } from './env';

/** connectionId -> 그 접속이 track한 메타 */
export type PresenceState = Record<string, Record<string, unknown>>;

type StateListener = (state: unknown) => void;
type PresenceListener = (presence: PresenceState) => void;

interface RoomConnection {
  socket: WebSocket | null;
  refCount: number;
  stateListeners: Set<StateListener>;
  presenceListeners: Set<PresenceListener>;
  presence: PresenceState;
  meta: Record<string, unknown> | null;
  retryCount: number;
  lastMessageAt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
}

/** 서버(worker/src/index.ts)가 없는/만료된 방에 쓰는 close code */
const CLOSE_ROOM_GONE = 4404;
const HEARTBEAT_INTERVAL_MS = 25_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
const MAX_RECONNECT_DELAY_MS = 10_000;
const RELEASE_DELAY_MS = 200;

// 방 하나당 소켓 하나를 페이지/RoomSharePanel이 같이 쓴다
const connections = new Map<string, RoomConnection>();

const open = (roomId: string, connection: RoomConnection) => {
  const baseUrl = getRealtimeUrl();
  if (!baseUrl || typeof window === 'undefined') return;

  const socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/rooms/${roomId}/ws`);
  connection.socket = socket;

  socket.onopen = () => {
    connection.retryCount = 0;
    connection.lastMessageAt = Date.now();
    if (connection.meta) {
      socket.send(JSON.stringify({ type: 'track', meta: connection.meta }));
    }
  };

  socket.onmessage = event => {
    connection.lastMessageAt = Date.now();
    if (typeof event.data !== 'string' || event.data === 'pong') return;

    let message: { type?: string; state?: unknown; presence?: Array<{ id: string; meta: Record<string, unknown> }> };
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.presence) {
      connection.presence = Object.fromEntries(message.presence.map(entry => [entry.id, entry.meta]));
      connection.presenceListeners.forEach(listener => listener(connection.presence));
    }

    if ((message.type === 'init' || message.type === 'state') && message.state) {
      connection.stateListeners.forEach(listener => listener(message.state));
    }
  };

  socket.onclose = event => {
    if (connection.socket !== socket) return;
    connection.socket = null;

    // 없는/만료된 방이면 다시 붙지 않는다
    if (event.code === CLOSE_ROOM_GONE || connection.refCount === 0) return;

    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** connection.retryCount);
    connection.retryCount += 1;
    connection.reconnectTimer = setTimeout(() => open(roomId, connection), delay);
  };
};

const acquire = (roomId: string) => {
  let connection = connections.get(roomId);

  if (!connection) {
    const created: RoomConnection = {
      socket: null,
      refCount: 0,
      stateListeners: new Set(),
      presenceListeners: new Set(),
      presence: {},
      meta: null,
      retryCount: 0,
      lastMessageAt: Date.now(),
      reconnectTimer: null,
      heartbeatTimer: null,
      closeTimer: null,
    };

    // 모바일에서 소켓이 조용히 죽는 경우를 감지해 다시 붙는다
    created.heartbeatTimer = setInterval(() => {
      const socket = created.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      if (Date.now() - created.lastMessageAt > HEARTBEAT_TIMEOUT_MS) {
        socket.close();
        return;
      }

      socket.send('ping');
    }, HEARTBEAT_INTERVAL_MS);

    connections.set(roomId, created);
    open(roomId, created);
    connection = created;
  }

  if (connection.closeTimer) {
    clearTimeout(connection.closeTimer);
    connection.closeTimer = null;
  }

  connection.refCount += 1;
  return connection;
};

const release = (roomId: string, connection: RoomConnection) => {
  connection.refCount -= 1;
  if (connection.refCount > 0) return;

  // effect 재실행(StrictMode, 의존성 변경)마다 소켓을 끊었다 붙이지 않도록 잠깐 기다린다
  connection.closeTimer = setTimeout(() => {
    if (connection.refCount > 0) return;

    if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer);
    if (connection.heartbeatTimer) clearInterval(connection.heartbeatTimer);
    connection.socket?.close(1000);
    connection.socket = null;
    connections.delete(roomId);
  }, RELEASE_DELAY_MS);
};

export const subscribeConnectionState = (roomId: string, listener: StateListener) => {
  const connection = acquire(roomId);
  connection.stateListeners.add(listener);

  return () => {
    connection.stateListeners.delete(listener);
    release(roomId, connection);
  };
};

/**
 * 접속자 목록(presence)을 구독한다. 하이라이트 같은 휘발성 정보 전용이며,
 * 게임 결과에 영향을 주는 상태는 절대 presence에 싣지 않는다.
 */
export const subscribePresence = (roomId: string, listener: PresenceListener) => {
  const connection = acquire(roomId);
  connection.presenceListeners.add(listener);
  listener(connection.presence);

  return () => {
    connection.presenceListeners.delete(listener);
    release(roomId, connection);
  };
};

/** 내 presence 메타를 갱신한다. 기존 값에 병합되고, 재연결 시 자동으로 다시 전송된다. */
export const trackPresence = (roomId: string, meta: Record<string, unknown>) => {
  const connection = connections.get(roomId);
  if (!connection) return;

  connection.meta = { ...connection.meta, ...meta };

  if (connection.socket?.readyState === WebSocket.OPEN) {
    connection.socket.send(JSON.stringify({ type: 'track', meta: connection.meta }));
  }
};
