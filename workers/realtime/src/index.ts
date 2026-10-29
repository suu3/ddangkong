import {
  createRelay,
  applyRelayCommand,
  advanceRelayDeadline,
  projectRelay,
  type RelayPrivateState,
} from '../../../src/shared/lib/drawing-relay';
import { DurableObject } from 'cloudflare:workers';
import {
  GAME_TYPES,
  type GameState,
  type GameType,
  MAX_MESSAGE_BYTES,
  ROOM_TTL_MS,
  type RoomSnapshot,
  type ServerEvent,
  isRecord,
  parseClientEvent,
  validActor,
  validRoomId,
} from '../../../src/shared/api/realtime-protocol';
import { applyCommand, authorizeStateUpdate, validateState } from './authorization';

interface Env {
  ROOMS: DurableObjectNamespace<RoomDurableObject>;
  CREATION_LIMITERS: DurableObjectNamespace<CreationLimiter>;
  ALLOWED_ORIGINS: string;
}
interface StoredRoom extends RoomSnapshot {
  hostActorId: string;
}
interface Session {
  actorId: string;
  role: 'host' | 'member';
  // Only sessions that have never authenticated expire after one minute.
  expiresAt?: number;
}
interface Attachment {
  session?: Session;
  ipHash?: string;
  presence: { cardIndex: number | null };
  connectedAt: number;
}
class HttpError extends Error {
  constructor(
    public code: string,
    public status = 400
  ) {
    super(code);
  }
}
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const errorResponse = (code: string, status = 400) => json({ error: { code, requestId: crypto.randomUUID() } }, status);
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
const hash = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n =>
    n.toString(16).padStart(2, '0')
  ).join('');
const publicRoom = ({ hostActorId: _host, ...room }: StoredRoom, actor: string | null = null): RoomSnapshot =>
  room.gameType === 'drawing_relay'
    ? { ...room, state: projectRelay(room.state as RelayPrivateState, actor, Date.now()) }
    : room;
async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
    throw new HttpError('JSON_REQUIRED', 415);
  if (!request.body) throw new HttpError('INVALID_BODY');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_MESSAGE_BYTES) {
      await reader.cancel();
      throw new HttpError('PAYLOAD_TOO_LARGE', 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(data)) throw new Error();
    return data;
  } catch {
    throw new HttpError('INVALID_BODY');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map(x => x.trim());
    if (origin && !allowed.includes(origin)) return errorResponse('ORIGIN_NOT_ALLOWED', 403);
    let response: Response;
    try {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
      else if (url.pathname === '/health' && request.method === 'GET') response = json({ ok: true, protocol: 1 });
      else if (url.pathname === '/rooms' && request.method === 'POST') {
        const body = await readJson(request);
        if (!GAME_TYPES.includes(body.gameType as GameType) || !validActor(body.actorId))
          throw new HttpError('INVALID_ROOM');
        if (body.gameType === 'drawing_relay') {
          body.state = createRelay(body.actorId as string, Date.now());
          body.maxCapacity = 10;
        } else validateState(body.gameType as GameType, body.state);
        if ((body.state as GameState).revision !== 0) throw new HttpError('INVALID_REVISION');
        if (
          (body.gameType === 'team_split' || body.gameType === 'hot_potato') &&
          (body.state as GameState).hostId !== body.actorId
        )
          throw new HttpError('INVALID_HOST');
        if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 30))
          throw new HttpError('INVALID_NAME');
        if (
          body.maxCapacity !== undefined &&
          (!Number.isSafeInteger(body.maxCapacity) || Number(body.maxCapacity) < 2 || Number(body.maxCapacity) > 20)
        )
          throw new HttpError('INVALID_CAPACITY');
        const ip = await hash(request.headers.get('CF-Connecting-IP') ?? 'local');
        const limited = await env.CREATION_LIMITERS.get(env.CREATION_LIMITERS.idFromName(ip)).fetch(
          new Request('https://internal/limit')
        );
        if (!limited.ok) throw new HttpError('ROOM_RATE_LIMITED', 429);
        const id = crypto.randomUUID();
        response = await env.ROOMS.get(env.ROOMS.idFromName(id)).fetch(
          new Request('https://internal/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, id }),
          })
        );
      } else {
        const match = url.pathname.match(/^\/rooms\/([^/]+)(\/join|\/connect)?$/);
        if (!match || !validRoomId(match[1])) throw new HttpError('ROOM_NOT_FOUND_OR_EXPIRED', 404);
        const suffix = match[2] ?? '';
        if ((suffix === '/join' && request.method !== 'POST') || (suffix !== '/join' && request.method !== 'GET'))
          throw new HttpError('METHOD_NOT_ALLOWED', 405);
        if (suffix === '/join' || suffix === '/connect') {
          const ip = await hash(request.headers.get('CF-Connecting-IP') ?? 'local');
          const limited = await env.CREATION_LIMITERS.get(env.CREATION_LIMITERS.idFromName(`${suffix}:${ip}`)).fetch(
            new Request(`https://internal${suffix}`)
          );
          if (!limited.ok) throw new HttpError('REQUEST_RATE_LIMITED', 429);
        }
        const target = new URL(`https://internal${suffix || '/snapshot'}`);
        const forwarded =
          suffix === '/join'
            ? new Request(target, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(await readJson(request)),
              })
            : new Request(target, request);
        response = await env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(forwarded);
      }
    } catch (error) {
      if (error instanceof HttpError) response = errorResponse(error.code, error.status);
      else if (error instanceof Error && error.message === 'INVALID_STATE') response = errorResponse('INVALID_STATE');
      else {
        console.error('realtime request failed', error);
        response = errorResponse('INTERNAL_ERROR', 500);
      }
    }
    const headers = new Headers(response.headers);
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Vary', 'Origin');
    return new Response(response.body, { status: response.status, headers, webSocket: response.webSocket });
  },
};

export class CreationLimiter extends DurableObject<Env> {
  async fetch(request: Request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const path = new URL(request.url).pathname;
      const windowMs = path === '/limit' ? 600000 : 60000;
      const maxRequests = path === '/limit' ? 5 : path === '/join' ? 30 : 60;
      const now = Date.now();
      const recent = ((await this.ctx.storage.get<number[]>('recent')) ?? []).filter(n => n > now - windowMs);
      if (recent.length >= maxRequests) return errorResponse('REQUEST_RATE_LIMITED', 429);
      await this.ctx.storage.put('recent', [...recent, now]);
      await this.ctx.storage.setAlarm(now + windowMs);
      return json({ ok: true });
    });
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

export class RoomDurableObject extends DurableObject<Env> {
  private connectedActors() {
    return new Set(
      this.ctx
        .getWebSockets()
        .filter(ws => ws.readyState === 1)
        .map(ws => (ws.deserializeAttachment() as Attachment)?.session?.actorId)
        .filter((actor): actor is string => Boolean(actor))
    );
  }
  private async stored() {
    return this.ctx.storage.get<StoredRoom>('room');
  }
  private send(ws: WebSocket, event: ServerEvent) {
    try {
      ws.send(JSON.stringify(event));
    } catch {
      ws.close(1011, 'send failed');
    }
  }
  private broadcast(event: ServerEvent) {
    for (const ws of this.ctx.getWebSockets())
      if ((ws.deserializeAttachment() as Attachment)?.session) this.send(ws, event);
  }
  private broadcastRoom(room: StoredRoom, requestId: string, onlyActor?: string) {
    for (const ws of this.ctx.getWebSockets()) {
      const session = (ws.deserializeAttachment() as Attachment)?.session;
      if (session && (!onlyActor || onlyActor === session.actorId))
        this.send(ws, { v: 1, type: 'state_updated', room: publicRoom(room, session.actorId), requestId });
    }
  }
  private presence() {
    const members = new Map<string, { actorId: string; presence: { cardIndex: number | null } }>();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment;
      if (a.session && ws.readyState === 1)
        members.set(a.session.actorId, { actorId: a.session.actorId, presence: a.presence });
    }
    this.broadcast({ v: 1, type: 'presence_updated', members: [...members.values()] });
  }
  private async active() {
    const room = await this.stored();
    if (!room) throw new HttpError('ROOM_NOT_FOUND_OR_EXPIRED', 404);
    if (Date.now() >= Date.parse(room.expiresAt)) throw new HttpError('ROOM_EXPIRED', 410);
    return room;
  }
  private async schedule(room: StoredRoom) {
    const game = room.state.game as { status?: string; endsAtMs?: number } | undefined;
    let deadline =
      room.gameType === 'hot_potato' && game?.status === 'running' && typeof game.endsAtMs === 'number'
        ? Math.min(Date.parse(room.expiresAt), game.endsAtMs)
        : Date.parse(room.expiresAt);
    if (
      room.gameType === 'drawing_relay' &&
      room.state.phase === 'playing' &&
      typeof room.state.deadlineMs === 'number'
    )
      deadline = Math.min(deadline, room.state.deadlineMs);
    const authenticationDeadlines = this.ctx
      .getWebSockets()
      .filter(ws => ws.readyState === 1)
      .map(ws => ws.deserializeAttachment() as Attachment)
      .filter(a => !a.session)
      .map(a => a.connectedAt + 10000);
    await this.ctx.storage.setAlarm(Math.min(deadline, ...authenticationDeadlines));
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/create') {
        return this.ctx.blockConcurrencyWhile(async () => {
          if (await this.stored()) return errorResponse('ROOM_EXISTS', 409);
          const b = await readJson(request);
          const secret = token();
          const now = Date.now();
          const room: StoredRoom = {
            id: b.id as string,
            gameType: b.gameType as GameType,
            name: (b.name as string) ?? '함께하는 게임 방',
            maxCapacity: (b.maxCapacity as number) ?? 10,
            state: b.state as GameState,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + ROOM_TTL_MS).toISOString(),
            hostActorId: b.actorId as string,
          };
          await this.ctx.storage.put({
            room,
            [`session:${await hash(secret)}`]: { actorId: room.hostActorId, role: 'host' },
          });
          await this.ctx.storage.setAlarm(now + ROOM_TTL_MS);
          return json(
            { room: publicRoom(room, room.hostActorId), token: secret, actorId: room.hostActorId, role: 'host' },
            201
          );
        });
      }
      const room = await this.active();
      if (path === '/snapshot') return json(publicRoom(room));
      if (path === '/join') {
        await readJson(request);
        return this.ctx.blockConcurrencyWhile(async () => {
          if (room.gameType === 'drawing_relay' && room.state.phase !== 'lobby')
            return errorResponse('GAME_STARTED', 409);
          const sessions = await this.ctx.storage.list<Session>({ prefix: 'session:' });
          for (const [key, session] of sessions) {
            if (session.role === 'member' && session.expiresAt !== undefined && session.expiresAt <= Date.now()) {
              await this.ctx.storage.delete(key);
              sessions.delete(key);
            }
          }
          const actors = new Set(
            this.ctx
              .getWebSockets()
              .map(ws => (ws.deserializeAttachment() as Attachment)?.session?.actorId)
              .filter(Boolean)
          );
          if (actors.size >= room.maxCapacity) return errorResponse('ROOM_FULL', 409);
          // Never let abandoned credentials permanently lock an otherwise empty room.
          if (sessions.size >= 200) {
            const unused = [...sessions].find(
              ([, session]) => session.role === 'member' && !actors.has(session.actorId)
            );
            if (!unused) return errorResponse('ROOM_FULL', 409);
            await this.ctx.storage.delete(unused[0]);
          }
          // Identity is server-issued. Claiming the creator's public actor ID never grants its session.
          const actorId = `anon-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
          const secret = token();
          await this.ctx.storage.put(`session:${await hash(secret)}`, {
            actorId,
            role: 'member',
            expiresAt: Date.now() + 60000,
          });
          return json({ room: publicRoom(room, actorId), token: secret, actorId, role: 'member' });
        });
      }
      if (path === '/connect') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
          return errorResponse('WEBSOCKET_REQUIRED', 426);
        const ipHash = await hash(request.headers.get('CF-Connecting-IP') ?? 'local');
        const sockets = this.ctx.getWebSockets().filter(ws => ws.readyState === 1);
        const pendingFromIp = sockets.filter(ws => {
          const attachment = ws.deserializeAttachment() as Attachment;
          return !attachment.session && attachment.ipHash === ipHash;
        });
        if (pendingFromIp.length >= 3 || sockets.length >= room.maxCapacity * 3)
          return errorResponse('TOO_MANY_CONNECTIONS', 429);
        const { 0: client, 1: server } = new WebSocketPair();
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({
          presence: { cardIndex: null },
          connectedAt: Date.now(),
          ipHash,
        } satisfies Attachment);
        await this.schedule(room);
        return new Response(null, { status: 101, webSocket: client });
      }
      return errorResponse('NOT_FOUND', 404);
    } catch (error) {
      return errorResponse(
        error instanceof HttpError ? error.code : 'INVALID_BODY',
        error instanceof HttpError ? error.status : 400
      );
    }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      let requestId: string | undefined;
      try {
        const room = await this.active();
        if (typeof message !== 'string' || new TextEncoder().encode(message).byteLength > MAX_MESSAGE_BYTES)
          throw new HttpError('INVALID_MESSAGE');
        const event = parseClientEvent(JSON.parse(message));
        if ('requestId' in event) requestId = event.requestId;
        const attachment = ws.deserializeAttachment() as Attachment;
        if (event.type === 'authenticate') {
          if (attachment.session) throw new HttpError('ALREADY_AUTHENTICATED');
          const session = await this.ctx.storage.get<Session>(`session:${await hash(event.token)}`);
          if (!session || (session.expiresAt !== undefined && session.expiresAt <= Date.now()))
            throw new HttpError('ROOM_SESSION_REQUIRED', 403);
          const actorConnections = this.ctx
            .getWebSockets()
            .filter(
              socket =>
                socket.readyState === 1 &&
                (socket.deserializeAttachment() as Attachment)?.session?.actorId === session.actorId
            );
          if (actorConnections.length >= 3) throw new HttpError('TOO_MANY_CONNECTIONS', 429);
          const connected = this.connectedActors();
          if (!connected.has(session.actorId) && connected.size >= room.maxCapacity)
            throw new HttpError('ROOM_FULL', 409);
          if (session.expiresAt !== undefined) {
            delete session.expiresAt;
            await this.ctx.storage.put(`session:${await hash(event.token)}`, session);
          }
          attachment.session = session;
          ws.serializeAttachment(attachment);
          await this.schedule(room);
          this.send(ws, { v: 1, type: 'snapshot', room: publicRoom(room, session.actorId), ...session });
          this.presence();
          return;
        }
        const session = attachment.session;
        if (!session) throw new HttpError('ROOM_SESSION_REQUIRED', 403);
        if (room.gameType === 'drawing_relay') {
          const advanced = advanceRelayDeadline(room.state as RelayPrivateState, Date.now());
          if (advanced !== room.state) {
            room.state = advanced;
            await this.ctx.storage.put('room', room);
            await this.schedule(room);
            this.broadcastRoom(room, 'server-timeout');
          }
          if (event.type !== 'presence_update') {
            if (event.type !== 'participant_command' || event.command.kind !== 'drawing_relay.command')
              throw new HttpError('MUTATION_NOT_ALLOWED');
            const action = event.command.action;
            const next = applyRelayCommand(room.state as RelayPrivateState, session.actorId, action, Date.now());
            room.state = next;
            await this.ctx.storage.put('room', room);
            await this.schedule(room);
            this.broadcastRoom(room, event.requestId, action.kind === 'draft' ? session.actorId : undefined);
            return;
          }
        }
        if (event.type === 'presence_update') {
          attachment.presence = { cardIndex: event.presence.cardIndex };
          ws.serializeAttachment(attachment);
          this.presence();
          this.send(ws, { v: 1, type: 'ack', requestId: event.requestId });
          return;
        }
        const key = `ack:${await hash(`${session.actorId}:${event.requestId}`)}`;
        const processed = await this.ctx.storage.get<boolean>(key);
        if (processed) {
          this.send(ws, { v: 1, type: 'state_updated', room: publicRoom(room), requestId: event.requestId });
          return;
        }
        if (event.type === 'state_update') authorizeStateUpdate(session.role);
        if (event.expectedRevision !== room.state.revision) {
          this.send(ws, { v: 1, type: 'error', code: 'STALE_REVISION', requestId, room: publicRoom(room) });
          return;
        }
        const next =
          event.type === 'state_update'
            ? event.state
            : applyCommand(
                room.gameType,
                room.state,
                session.actorId,
                event.command,
                Date.now(),
                room.maxCapacity,
                this.connectedActors()
              );
        const canonical: GameState = { ...next, revision: room.state.revision + 1, lastActor: session.actorId };
        validateState(room.gameType, canonical);
        if ((room.gameType === 'hot_potato' || room.gameType === 'team_split') && canonical.hostId !== room.hostActorId)
          throw new HttpError('INVALID_HOST');
        room.state = canonical;
        await this.ctx.storage.put({ room, [key]: true });
        await this.schedule(room);
        // Keep a bounded request history; old duplicates still fail revision checks.
        const acks = await this.ctx.storage.list({ prefix: 'ack:' });
        if (acks.size > 200) await this.ctx.storage.delete([...acks.keys()].slice(0, acks.size - 200));
        this.broadcast({ v: 1, type: 'state_updated', room: publicRoom(room), requestId: event.requestId });
      } catch (error) {
        const code = error instanceof Error ? error.message : 'INVALID_MESSAGE';
        this.send(ws, { v: 1, type: 'error', code, requestId });
        if (
          [
            'ROOM_EXPIRED',
            'ROOM_NOT_FOUND_OR_EXPIRED',
            'ROOM_SESSION_REQUIRED',
            'ROOM_FULL',
            'TOO_MANY_CONNECTIONS',
          ].includes(code)
        )
          ws.close(4001, code);
      }
    });
  }
  async webSocketClose(ws: WebSocket, code: number) {
    ws.close(code === 1005 ? 1000 : code, 'closed');
    this.presence();
  }
  async webSocketError(ws: WebSocket) {
    ws.close(1011, 'connection error');
    this.presence();
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const room = await this.stored();
      if (room && Date.now() < Date.parse(room.expiresAt)) {
        for (const ws of this.ctx.getWebSockets()) {
          const attachment = ws.deserializeAttachment() as Attachment;
          if (!attachment.session && Date.now() >= attachment.connectedAt + 10000) {
            this.send(ws, { v: 1, type: 'error', code: 'ROOM_SESSION_REQUIRED' });
            ws.close(4003, 'authentication timeout');
          }
        }
        if (room.gameType === 'drawing_relay') {
          const next = advanceRelayDeadline(room.state as RelayPrivateState, Date.now());
          if (next !== room.state) {
            room.state = next;
            await this.ctx.storage.put('room', room);
            this.broadcastRoom(room, 'server-timeout');
          }
        }
        const game = room.state.game as any;
        if (room.gameType === 'hot_potato' && game?.status === 'running' && Date.now() >= game.endsAtMs) {
          room.state = {
            ...room.state,
            revision: room.state.revision + 1,
            game: {
              ...game,
              status: 'ended',
              winnerUserId: game.holderUserId,
              reason: 'timeout',
              history: [
                ...game.history,
                { roundId: game.roundId, winnerUserId: game.holderUserId, endedAtMs: game.endsAtMs, reason: 'timeout' },
              ].slice(-20),
            },
          };
          await this.ctx.storage.put('room', room);
          this.broadcast({ v: 1, type: 'state_updated', room: publicRoom(room), requestId: 'server-timeout' });
        }
        await this.schedule(room);
        return;
      }
      this.broadcast({ v: 1, type: 'room_expired' });
      for (const ws of this.ctx.getWebSockets()) ws.close(4001, 'ROOM_EXPIRED');
      await this.ctx.storage.deleteAll();
    });
  }
}
