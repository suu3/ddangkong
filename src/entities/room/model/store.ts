import {
  RealtimeError,
  RealtimeSocket,
  getRealtimeApiUrl,
  isRoomSnapshot,
  realtimeRequest,
} from '../../../shared/api/realtime-client';
import {
  ConnectionStatus,
  GameState,
  ParticipantCommand,
  RoomMember,
  RoomSnapshot,
  ServerEvent,
} from '../../../shared/api/realtime-protocol';
import { RoomSession, readSession, saveSession } from '../api/session';

export interface RoomModel {
  room: RoomSnapshot | null;
  members: RoomMember[];
  status: ConnectionStatus;
  actorId: string;
  role: 'host' | 'member';
  error: string | null;
}
export const EMPTY_ROOM: RoomModel = {
  room: null,
  members: [],
  status: 'disabled',
  actorId: 'guest',
  role: 'member',
  error: null,
};
const stores = new Map<string, RoomStore>();
export function getRoomStore(id: string): RoomStore {
  let store = stores.get(id);
  if (!store) {
    store = new RoomStore(id);
    stores.set(id, store);
  }
  return store;
}
export class RoomStore {
  private state: RoomModel = EMPTY_ROOM;
  private listeners = new Set<() => void>();
  private owners = 0;
  private generation = 0;
  private socket: RealtimeSocket | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private id: string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(patch: Partial<RoomModel>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(fn => fn());
  }
  private acceptRoom(room: RoomSnapshot) {
    if (room.id !== this.id) return;
    if (this.state.room && room.state.revision < this.state.room.state.revision) return;
    this.patch({ room });
  }
  private onEvent = (event: ServerEvent) => {
    if (event.type === 'snapshot') {
      this.acceptRoom(event.room);
      this.patch({ actorId: event.actorId, role: event.role, error: null });
    }
    if (event.type === 'state_updated') this.acceptRoom(event.room);
    if (event.type === 'presence_updated') this.patch({ members: event.members });
    if (event.type === 'error') {
      if (event.room) this.acceptRoom(event.room);
      this.patch({ error: event.code });
    }
  };
  acquire = () => {
    if (!stores.has(this.id)) stores.set(this.id, this);
    if (this.owners++ === 0) void this.start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.owners === 0) {
        this.generation++;
        this.socket?.close();
        this.socket = null;
        this.patch({ status: 'disabled', members: [] });
        // A released room cannot retain a socket or grow the registry indefinitely.
        if (stores.get(this.id) === this) stores.delete(this.id);
      }
    };
  };
  private async start() {
    const base = getRealtimeApiUrl();
    if (!base) return;
    const generation = ++this.generation;
    this.patch({ status: 'connecting', error: null });
    try {
      let session = readSession(this.id);
      if (session) {
        const room = await realtimeRequest<RoomSnapshot>(`/rooms/${this.id}`);
        if (generation !== this.generation) return;
        if (!isRoomSnapshot(room)) throw new RealtimeError('INVALID_RESPONSE');
        this.acceptRoom(room);
      }
      if (!session) {
        const joined = await realtimeRequest<RoomSession & { room: RoomSnapshot }>(`/rooms/${this.id}/join`, {});
        if (generation !== this.generation) return;
        if (!isRoomSnapshot(joined.room) || typeof joined.token !== 'string' || typeof joined.actorId !== 'string')
          throw new RealtimeError('INVALID_RESPONSE');
        session = joined;
        saveSession(this.id, joined);
        this.acceptRoom(joined.room);
      }
      if (generation !== this.generation || !this.owners) return;
      this.patch({ actorId: session.actorId, role: session.role });
      this.socket = new RealtimeSocket(
        base,
        this.id,
        session.token,
        this.onEvent,
        status => {
          if (generation === this.generation)
            this.patch({ status, ...(status === 'connected' ? { error: null } : {}) });
        },
        async () => {
          try {
            const room = await realtimeRequest<RoomSnapshot>(`/rooms/${this.id}`);
            if (generation !== this.generation) return false;
            if (isRoomSnapshot(room)) this.acceptRoom(room);
            return true;
          } catch (error) {
            if (generation !== this.generation) return false;
            if (error instanceof RealtimeError && ['ROOM_EXPIRED', 'ROOM_NOT_FOUND_OR_EXPIRED'].includes(error.code)) {
              this.patch({ status: 'expired', error: error.code });
              this.socket?.close();
              return false;
            }
            return true;
          }
        }
      );
      this.socket.connect();
    } catch (error) {
      if (generation !== this.generation) return;
      const code =
        error instanceof RealtimeError ? error.code : error instanceof Error ? error.message : 'SERVICE_UNAVAILABLE';
      this.patch({
        status: ['ROOM_EXPIRED', 'ROOM_NOT_FOUND_OR_EXPIRED'].includes(code) ? 'expired' : 'error',
        error: code,
      });
    }
  }
  retry = () => {
    this.socket?.close();
    this.socket = null;
    void this.start();
  };
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }
  mutate<T>(makeState: (current: T) => T | Omit<T, 'revision' | 'lastActor'>): Promise<T> {
    return this.enqueue(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const current = this.state.room;
        if (!current || !this.socket) throw new RealtimeError('NOT_CONNECTED');
        const next = makeState(current.state as T);
        try {
          const room = await this.socket.request({
            type: 'state_update',
            state: { ...next, revision: current.state.revision, lastActor: this.state.actorId } as GameState,
            expectedRevision: current.state.revision,
          });
          if (!room) throw new RealtimeError('INVALID_RESPONSE');
          this.acceptRoom(room);
          this.patch({ error: null });
          return room.state as T;
        } catch (error) {
          if (error instanceof RealtimeError && error.room) this.acceptRoom(error.room);
          if (!(error instanceof RealtimeError) || error.code !== 'STALE_REVISION' || attempt > 0) {
            this.patch({ error: error instanceof Error ? error.message : 'SERVICE_UNAVAILABLE' });
            throw error;
          }
        }
      }
      throw new RealtimeError('STALE_REVISION');
    });
  }
  command = (command: ParticipantCommand) =>
    this.enqueue(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!this.socket || !this.state.room) throw new RealtimeError('NOT_CONNECTED');
        try {
          const room = await this.socket.request({
            type: 'participant_command',
            command,
            expectedRevision: this.state.room.state.revision,
          });
          if (room) this.acceptRoom(room);
          this.patch({ error: null });
          return;
        } catch (error) {
          if (error instanceof RealtimeError && error.room) this.acceptRoom(error.room);
          if (!(error instanceof RealtimeError) || error.code !== 'STALE_REVISION' || attempt > 0) {
            this.patch({ error: error instanceof Error ? error.message : 'SERVICE_UNAVAILABLE' });
            throw error;
          }
        }
      }
    });
  updatePresence = (cardIndex: number | null) => {
    void this.socket?.request({ type: 'presence_update', presence: { cardIndex } }).catch(() => {});
  };
}
