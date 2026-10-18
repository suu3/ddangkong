import {
  ClientEvent,
  ConnectionStatus,
  GameState,
  RoomSnapshot,
  ServerEvent,
  isRecord,
  validRevision,
} from './realtime-protocol';

export class RealtimeError extends Error {
  constructor(
    public code: string,
    public room?: RoomSnapshot
  ) {
    super(code);
  }
}
export function getRealtimeApiUrl() {
  const raw = process.env.NEXT_PUBLIC_REALTIME_API_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname))
    )
      return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
export const hasRealtimeConfig = () => getRealtimeApiUrl() !== null;
export async function realtimeRequest<T>(path: string, body?: unknown): Promise<T> {
  const base = getRealtimeApiUrl();
  if (!base) throw new RealtimeError('NOT_CONFIGURED');
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  if (!response.ok) throw new RealtimeError(value?.error?.code ?? 'SERVICE_UNAVAILABLE');
  return value as T;
}
export function isRoomSnapshot(value: unknown): value is RoomSnapshot {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    ['coffee', 'roulette', 'hot_potato', 'team_split'].includes(String(value.gameType)) &&
    typeof value.name === 'string' &&
    Number.isSafeInteger(value.maxCapacity) &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.expiresAt === 'string' &&
    Number.isFinite(Date.parse(value.expiresAt)) &&
    isRecord(value.state) &&
    validRevision(value.state.revision) &&
    (value.state.lastActor === null || typeof value.state.lastActor === 'string')
  );
}
function parseServerEvent(value: unknown): ServerEvent | null {
  if (!isRecord(value) || value.v !== 1) return null;
  if (
    value.type === 'snapshot' &&
    isRoomSnapshot(value.room) &&
    ['host', 'member'].includes(String(value.role)) &&
    typeof value.actorId === 'string'
  )
    return value as unknown as ServerEvent;
  if (value.type === 'state_updated' && isRoomSnapshot(value.room) && typeof value.requestId === 'string')
    return value as unknown as ServerEvent;
  if (
    value.type === 'presence_updated' &&
    Array.isArray(value.members) &&
    value.members.length <= 60 &&
    value.members.every(
      m =>
        isRecord(m) &&
        typeof m.actorId === 'string' &&
        isRecord(m.presence) &&
        (m.presence.cardIndex === null || validRevision(m.presence.cardIndex))
    )
  )
    return value as unknown as ServerEvent;
  if (value.type === 'ack' && typeof value.requestId === 'string') return value as unknown as ServerEvent;
  if (value.type === 'room_expired') return value as unknown as ServerEvent;
  if (
    value.type === 'error' &&
    typeof value.code === 'string' &&
    (value.requestId === undefined || typeof value.requestId === 'string') &&
    (value.room === undefined || isRoomSnapshot(value.room))
  )
    return value as unknown as ServerEvent;
  return null;
}
type RequestEvent =
  | { type: 'state_update'; state: GameState; expectedRevision: number }
  | {
      type: 'participant_command';
      command: Extract<ClientEvent, { type: 'participant_command' }>['command'];
      expectedRevision: number;
    }
  | { type: 'presence_update'; presence: { cardIndex: number | null } };

export class RealtimeSocket {
  private socket: WebSocket | null = null;
  private disposed = false;
  private ready = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private offline = () => {
    this.socket?.close();
    this.onStatus('reconnecting');
  };
  private online = () => {
    if (this.timer) clearTimeout(this.timer);
    if (!this.disposed && !this.ready) void this.reconnect();
  };
  private pending = new Map<
    string,
    {
      resolve: (room: RoomSnapshot | undefined) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private base: string,
    private roomId: string,
    private token: string,
    private onEvent: (event: ServerEvent) => void,
    private onStatus: (status: ConnectionStatus) => void,
    private beforeReconnect?: () => Promise<boolean>
  ) {}
  private async reconnect() {
    if (this.disposed || (this.socket && this.socket.readyState < 2)) return;
    if (this.beforeReconnect && !(await this.beforeReconnect())) return;
    this.connect();
  }
  connect() {
    if (this.disposed) return;
    if (this.socket && this.socket.readyState < 2) return;
    if (!this.listening && typeof window !== 'undefined') {
      window.addEventListener?.('offline', this.offline);
      window.addEventListener?.('online', this.online);
      this.listening = true;
    }
    this.onStatus(this.attempt ? 'reconnecting' : 'connecting');
    const url = new URL(`${this.base}/rooms/${this.roomId}/connect`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url.toString());
    this.socket = socket;
    const authTimer = setTimeout(() => socket.close(), 10000);
    socket.onopen = () => {
      if (this.disposed || this.socket !== socket) {
        socket.close();
        return;
      }
      socket.send(JSON.stringify({ v: 1, type: 'authenticate', token: this.token }));
    };
    socket.onmessage = event => {
      if (this.disposed || this.socket !== socket || typeof event.data !== 'string') return;
      let value: ServerEvent | null;
      try {
        value = parseServerEvent(JSON.parse(event.data));
      } catch {
        return;
      }
      if (!value) return;
      if (value.type === 'snapshot') {
        clearTimeout(authTimer);
        this.ready = true;
        this.attempt = 0;
        this.onStatus('connected');
      }
      if ('requestId' in value && value.requestId) {
        const pending = this.pending.get(value.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(value.requestId);
          if (value.type === 'error') pending.reject(new RealtimeError(value.code, value.room));
          else pending.resolve('room' in value ? value.room : undefined);
        }
      }
      this.onEvent(value);
      if (
        value.type === 'room_expired' ||
        (value.type === 'error' &&
          ['ROOM_EXPIRED', 'ROOM_NOT_FOUND_OR_EXPIRED', 'ROOM_SESSION_REQUIRED', 'ROOM_FULL'].includes(value.code))
      ) {
        this.close();
        this.onStatus(
          value.type === 'error' && ['ROOM_SESSION_REQUIRED', 'ROOM_FULL'].includes(value.code) ? 'error' : 'expired'
        );
      }
    };
    socket.onerror = () => {
      socket.close();
    };
    socket.onclose = () => {
      clearTimeout(authTimer);
      if (this.socket !== socket) return;
      this.ready = false;
      this.rejectPending('CONNECTION_LOST');
      if (this.disposed) return;
      this.onStatus('reconnecting');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const delay = Math.min(250 * 2 ** this.attempt++, 10000);
      this.timer = setTimeout(() => {
        void this.reconnect();
      }, delay);
    };
  }
  request(event: RequestEvent): Promise<RoomSnapshot | undefined> {
    if (!this.ready || this.socket?.readyState !== 1) return Promise.reject(new RealtimeError('NOT_CONNECTED'));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new RealtimeError('REQUEST_TIMEOUT'));
      }, 15000);
      this.pending.set(requestId, { resolve, reject, timer });
      try {
        this.socket!.send(JSON.stringify({ v: 1, ...event, requestId }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(new RealtimeError('CONNECTION_LOST'));
      }
    });
  }
  private rejectPending(code: string) {
    this.pending.forEach(p => {
      clearTimeout(p.timer);
      p.reject(new RealtimeError(code));
    });
    this.pending.clear();
  }
  close() {
    this.disposed = true;
    this.ready = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.listening && typeof window !== 'undefined') {
      window.removeEventListener?.('offline', this.offline);
      window.removeEventListener?.('online', this.online);
    }
    this.socket?.close();
    this.rejectPending('CONNECTION_LOST');
  }
}
