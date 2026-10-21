import { parseRelayCommand, type RelayCommand } from '../lib/drawing-relay';
export type GameType = 'coffee' | 'roulette' | 'team_split' | 'hot_potato' | 'drawing_relay';
export type GameState = Record<string, unknown> & { revision: number; lastActor: string | null };
export interface RoomSnapshot<T = GameState> {
  id: string;
  gameType: GameType;
  name: string;
  maxCapacity: number;
  state: T;
  createdAt: string;
  expiresAt: string;
}
export interface RoomMember {
  actorId: string;
  presence: { cardIndex: number | null };
}
export type ConnectionStatus = 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'expired' | 'error';
export type ParticipantCommand =
  | { kind: 'drawing_relay.command'; action: RelayCommand }
  | { kind: 'coffee.select'; cardIndex: number | null }
  | { kind: 'hot_potato.join'; nickname: string; isReady: boolean }
  | { kind: 'hot_potato.rename'; nickname: string }
  | { kind: 'hot_potato.ready'; isReady: boolean }
  | { kind: 'hot_potato.pass' };
export type ClientEvent =
  | { v: 1; type: 'authenticate'; token: string }
  | { v: 1; type: 'presence_update'; requestId: string; presence: { cardIndex: number | null } }
  | { v: 1; type: 'state_update'; requestId: string; expectedRevision: number; state: GameState }
  | { v: 1; type: 'participant_command'; requestId: string; expectedRevision: number; command: ParticipantCommand };
export type ServerEvent =
  | { v: 1; type: 'snapshot'; room: RoomSnapshot; role: 'host' | 'member'; actorId: string }
  | { v: 1; type: 'state_updated'; room: RoomSnapshot; requestId: string }
  | { v: 1; type: 'presence_updated'; members: RoomMember[] }
  | { v: 1; type: 'ack'; requestId: string }
  | { v: 1; type: 'room_expired' }
  | { v: 1; type: 'error'; code: string; requestId?: string; room?: RoomSnapshot };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export const validCard = (value: unknown): value is number | null =>
  value === null || (validRevision(value) && Number(value) < 100);
export const validActor = (value: unknown): value is string =>
  typeof value === 'string' && /^anon-[a-zA-Z0-9-]{8,64}$/.test(value);
export const validRoomId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const GAME_TYPES: GameType[] = ['coffee', 'roulette', 'team_split', 'hot_potato', 'drawing_relay'];
export const ROOM_TTL_MS = 86_400_000;
export const MAX_MESSAGE_BYTES = 65_536;

export function parseClientEvent(value: unknown): ClientEvent {
  if (!isRecord(value)) throw new Error('INVALID_MESSAGE');
  if (value.v !== 1) throw new Error('UNSUPPORTED_PROTOCOL');
  if (value.type === 'authenticate' && typeof value.token === 'string' && /^[a-f0-9]{64}$/.test(value.token))
    return value as ClientEvent;
  if (typeof value.requestId !== 'string' || value.requestId.length < 1 || value.requestId.length > 80)
    throw new Error('INVALID_MESSAGE');
  if (value.type === 'presence_update' && isRecord(value.presence) && validCard(value.presence.cardIndex))
    return value as ClientEvent;
  if (!validRevision(value.expectedRevision)) throw new Error('INVALID_REVISION');
  if (value.type === 'state_update' && isRecord(value.state) && validRevision(value.state.revision))
    return value as ClientEvent;
  if (value.type === 'participant_command' && isRecord(value.command)) {
    const command = value.command;
    if (command.kind === 'drawing_relay.command') {
      parseRelayCommand(command.action);
      return value as ClientEvent;
    }
    if (command.kind === 'coffee.select' && validCard(command.cardIndex)) return value as ClientEvent;
    if (command.kind === 'hot_potato.pass') return value as ClientEvent;
    if (command.kind === 'hot_potato.ready' && typeof command.isReady === 'boolean') return value as ClientEvent;
    if (
      (command.kind === 'hot_potato.join' || command.kind === 'hot_potato.rename') &&
      typeof command.nickname === 'string' &&
      command.nickname.trim().length >= 1 &&
      command.nickname.length <= 20 &&
      (command.kind !== 'hot_potato.join' || typeof command.isReady === 'boolean')
    )
      return value as ClientEvent;
  }
  throw new Error('INVALID_MESSAGE');
}

