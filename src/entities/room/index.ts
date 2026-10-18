export { useRoom } from './model/useRoom';
export { roomErrorMessage } from './model/messages';
export { createRoom, getRoom, assertJoinableRoom, normalizeRoomId, getGameLabel, isRoomExpired } from './api/rooms';
export type { RealtimeGameType } from './api/rooms';
export { hasRealtimeConfig } from '../../shared/api/realtime-client';
export type { ConnectionStatus, RoomMember } from '../../shared/api/realtime-protocol';

export { getServerActor, buildActorAliasMap, consumeActorRotationNotice, getActorAlias } from './lib/clientActor';
