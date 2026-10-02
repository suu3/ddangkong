/**
 * 심심풀이 땅콩 실시간 서버 (Cloudflare Worker + Durable Object).
 *
 * 방 하나 = Room Durable Object 하나. 방 상태 저장, revision 낙관적 잠금,
 * 상태 broadcast, presence(접속자 목록)를 모두 Room이 담당한다.
 *
 *  - POST /rooms          방 생성
 *  - GET  /rooms/:id      방 조회
 *  - PUT  /rooms/:id      방 상태 저장 (expectedRevision 불일치 시 409)
 *  - GET  /rooms/:id/ws   WebSocket (상태/presence 수신, presence track)
 */
import { DurableObject } from 'cloudflare:workers';

interface Env {
  ROOM: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS?: string;
}

interface RoomRow {
  id: string;
  status: string;
  game_type: string;
  name: string | null;
  max_capacity: number | null;
  game_state: GameState;
  created_at: string;
}

type GameState = Record<string, unknown> & { revision?: number };

interface UpdateResult {
  room: RoomRow | null;
  error: 'not_found' | 'conflict' | null;
}

interface SocketAttachment {
  id: string;
  meta: Record<string, unknown> | null;
}

/** 클라이언트(lib/realtime/rooms.ts)의 값과 동일하게 유지한다 */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const GAME_TYPES = ['coffee', 'roulette', 'hot_potato', 'team_split'];
const ROOM_NAME_MAX_LENGTH = 30;
const MAX_CAPACITY_MIN = 2;
const MAX_CAPACITY_MAX = 20;
const DEFAULT_MAX_CAPACITY = 10;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PRESENCE_META_BYTES = 1024;

/** 방이 없거나 만료됐을 때 쓰는 WebSocket close code. 클라이언트는 이 코드면 재연결하지 않는다. */
const CLOSE_ROOM_GONE = 4404;

const ROOM_KEY = 'room';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // 하트비트는 DO를 깨우지 않고 런타임이 바로 응답한다 (hibernation 유지)
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private async loadRoom(): Promise<RoomRow | null> {
    const room = await this.ctx.storage.get<RoomRow>(ROOM_KEY);
    if (!room) return null;

    if (Date.now() - new Date(room.created_at).getTime() > ROOM_TTL_MS) {
      await this.expire();
      return null;
    }

    return room;
  }

  async createRoom(input: Omit<RoomRow, 'created_at'>): Promise<RoomRow> {
    const room: RoomRow = { ...input, created_at: new Date().toISOString() };
    await this.ctx.storage.put(ROOM_KEY, room);
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
    return room;
  }

  async getRoom(): Promise<RoomRow | null> {
    return this.loadRoom();
  }

  /**
   * Durable Object는 요청을 하나씩 처리하므로 revision 비교와 저장이 원자적으로 끝난다.
   * 저장에 성공한 상태만 접속자 전원에게 broadcast한다.
   */
  async updateState(gameState: GameState, expectedRevision?: number): Promise<UpdateResult> {
    const room = await this.loadRoom();
    if (!room) return { room: null, error: 'not_found' };

    if (typeof expectedRevision === 'number' && room.game_state.revision !== expectedRevision) {
      return { room: null, error: 'conflict' };
    }

    const next: RoomRow = { ...room, game_state: gameState };
    await this.ctx.storage.put(ROOM_KEY, next);
    this.broadcast({ type: 'state', state: gameState });

    return { room: next, error: null };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    const room = await this.loadRoom();

    if (!room) {
      server.accept();
      server.close(CLOSE_ROOM_GONE, 'room not found');
      return new Response(null, { status: 101, webSocket: client });
    }

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID(), meta: null } satisfies SocketAttachment);
    server.send(JSON.stringify({ type: 'init', state: room.game_state, presence: this.presenceList() }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message.length > MAX_PRESENCE_META_BYTES) return;

    let data: { type?: string; meta?: unknown };
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    // 게임 결과에 영향을 주는 상태는 presence로 받지 않는다. (상태 변경은 PUT /rooms/:id 로만)
    if (data.type !== 'track' || !data.meta || typeof data.meta !== 'object' || Array.isArray(data.meta)) return;

    const attachment = ws.deserializeAttachment() as SocketAttachment;
    ws.serializeAttachment({ ...attachment, meta: data.meta as Record<string, unknown> });
    this.broadcastPresence();
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      // 1005/1006은 예약된 코드라 그대로 돌려보낼 수 없다
      ws.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {
      // 이미 닫힌 소켓
    }
    this.broadcastPresence(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.broadcastPresence(ws);
  }

  async alarm() {
    await this.expire();
  }

  private async expire() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(CLOSE_ROOM_GONE, 'room expired');
      } catch {
        // 이미 닫힌 소켓
      }
    }
    await this.ctx.storage.deleteAll();
  }

  private presenceList(except?: WebSocket) {
    const list: SocketAttachment[] = [];

    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const attachment = ws.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.meta) list.push(attachment);
    }

    return list;
  }

  private broadcastPresence(except?: WebSocket) {
    this.broadcast({ type: 'presence', presence: this.presenceList(except) }, except);
  }

  private broadcast(message: unknown, except?: WebSocket) {
    const payload = JSON.stringify(message);

    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(payload);
      } catch {
        // 닫히는 중인 소켓은 건너뛴다
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // 브라우저 요청은 허용된 origin에서만 받는다
    if (origin && !isAllowedOrigin(origin, env)) {
      return json({ error: 'forbidden_origin' }, 403, cors);
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'rooms' || segments.length > 3) {
      return json({ error: 'not_found' }, 404, cors);
    }

    if (segments.length === 1) {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
      return handleCreate(request, env, cors);
    }

    const roomId = segments[1];
    if (!UUID_PATTERN.test(roomId)) {
      return json({ error: 'not_found' }, 404, cors);
    }

    const stub = env.ROOM.get(env.ROOM.idFromName(roomId.toLowerCase()));

    if (segments.length === 3) {
      if (segments[2] !== 'ws' || request.method !== 'GET') return json({ error: 'not_found' }, 404, cors);
      return stub.fetch(request);
    }

    if (request.method === 'GET') {
      const room = await stub.getRoom();
      return room ? json(room, 200, cors) : json({ error: 'not_found' }, 404, cors);
    }

    if (request.method === 'PUT') {
      const body = await readJson(request);
      if (!body || !isPlainObject(body.game_state)) {
        return json({ error: 'invalid_body' }, 400, cors);
      }

      const expectedRevision = typeof body.expectedRevision === 'number' ? body.expectedRevision : undefined;
      // game_state가 임의 JSON이라 RPC 반환 타입 추론이 never로 떨어진다
      const result = (await stub.updateState(
        body.game_state as GameState,
        expectedRevision
      )) as unknown as UpdateResult;

      if (result.room) return json(result.room, 200, cors);
      return json({ error: result.error }, result.error === 'conflict' ? 409 : 404, cors);
    }

    return json({ error: 'method_not_allowed' }, 405, cors);
  },
} satisfies ExportedHandler<Env>;

async function handleCreate(request: Request, env: Env, cors: Record<string, string>) {
  const body = await readJson(request);
  if (!body || !isPlainObject(body.game_state)) {
    return json({ error: 'invalid_body' }, 400, cors);
  }

  if (typeof body.game_type !== 'string' || !GAME_TYPES.includes(body.game_type)) {
    return json({ error: 'invalid_game_type' }, 400, cors);
  }

  const id = crypto.randomUUID();
  const stub = env.ROOM.get(env.ROOM.idFromName(id));
  const room = await stub.createRoom({
    id,
    status: 'active',
    game_type: body.game_type,
    name: sanitizeRoomName(body.name),
    max_capacity: sanitizeMaxCapacity(body.max_capacity),
    game_state: body.game_state as GameState,
  });

  return json(room, 201, cors);
}

// 브라우저 요청은 얼마든지 위조할 수 있으므로 클라이언트 검증과 별개로 여기서 다시 거른다
function sanitizeRoomName(name: unknown) {
  if (typeof name !== 'string') return null;

  const cleaned = Array.from(name)
    .map(char => {
      const code = char.charCodeAt(0);
      return code <= 0x1f || code === 0x7f ? ' ' : char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned ? cleaned.slice(0, ROOM_NAME_MAX_LENGTH) : null;
}

function sanitizeMaxCapacity(maxCapacity: unknown) {
  if (typeof maxCapacity !== 'number' || !Number.isFinite(maxCapacity)) return DEFAULT_MAX_CAPACITY;
  return Math.min(MAX_CAPACITY_MAX, Math.max(MAX_CAPACITY_MIN, Math.floor(maxCapacity)));
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowedOrigin(origin: string, env: Env) {
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  return allowed.includes('*') || allowed.includes(origin);
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  if (!origin || !isAllowedOrigin(origin, env)) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
