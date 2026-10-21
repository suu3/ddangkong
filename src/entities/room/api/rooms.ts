import { realtimeRequest, isRoomSnapshot, RealtimeError } from '../../../shared/api/realtime-client';
import type { RoomSnapshot } from '../../../shared/api/realtime-protocol';
import { saveSession, type RoomSession } from './session';
import { roomErrorMessage } from '../model/messages';
import { getServerActor } from '../lib/clientActor';

export type RealtimeGameType = 'coffee' | 'roulette' | 'hot_potato' | 'team_split' | 'drawing_relay';

/** 방 생성 후 이 시간이 지나면 만료된 방으로 취급합니다. (DB 정리 정책과 동일한 값 유지) */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

/** 클라이언트 측 방 생성 제한: RATE_LIMIT_WINDOW_MS 동안 RATE_LIMIT_MAX_ROOMS 개까지 */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ROOMS = 5;
const RATE_LIMIT_STORAGE_KEY = 'realtime:room-create-log';

const ROOM_NAME_MAX_LENGTH = 30;
const MAX_CAPACITY_MIN = 2;
const MAX_CAPACITY_MAX = 20;
const DEFAULT_MAX_CAPACITY = 10;

/** 사용자에게 그대로 노출해도 되는 메시지를 가진 에러. 개발자용 상세는 detail에 담습니다. */
export class RealtimeRoomError extends Error {
  readonly code: string;
  readonly detail?: string;

  constructor(code: string, message: string, detail?: string) {
    super(message);
    this.name = 'RealtimeRoomError';
    this.code = code;
    this.detail = detail;

    if (detail) {
      // 사용자에게는 짧은 문구만 보여주고, 원인은 콘솔로 남깁니다.
      console.error(`[realtime] ${code}: ${detail}`);
    }
  }
}

export const getGameLabel = (gameType: RealtimeGameType) => {
  if (gameType === 'drawing_relay') return '낙서 이어달리기';
  if (gameType === 'coffee') return '커피 내기';
  if (gameType === 'roulette') return '룰렛';
  if (gameType === 'hot_potato') return '폭탄 돌리기';
  return '팀 나누기';
};

const getDefaultRoomName = (gameType: RealtimeGameType) => `${getGameLabel(gameType)} 방`;

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

export const sanitizeRoomName = (name: string | undefined, gameType: RealtimeGameType) => {
  const fallback = getDefaultRoomName(gameType);
  if (!name) return fallback;

  // 제어문자를 공백으로 바꾼 뒤 공백을 정리합니다.
  const cleaned = Array.from(name)
    .map(char => {
      const code = char.charCodeAt(0);
      return code <= 0x1f || code === 0x7f ? ' ' : char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return fallback;
  return cleaned.slice(0, ROOM_NAME_MAX_LENGTH);
};

export const sanitizeMaxCapacity = (maxCapacity: number | undefined) => {
  if (typeof maxCapacity !== 'number' || !Number.isFinite(maxCapacity)) {
    return DEFAULT_MAX_CAPACITY;
  }

  const rounded = Math.floor(maxCapacity);
  return Math.min(MAX_CAPACITY_MAX, Math.max(MAX_CAPACITY_MIN, rounded));
};

export const normalizeRoomId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // 방 링크를 통째로 붙여넣어도 roomId를 뽑아낼 수 있게 처리
  try {
    const parsed = new URL(trimmed);
    const fromQuery = parsed.searchParams.get('roomId');
    if (fromQuery && isUuid(fromQuery)) return fromQuery.trim();
  } catch {
    // URL이 아니면 그대로 검사
  }

  return isUuid(trimmed) ? trimmed : null;
};

export const isRoomExpired = (createdAt: string, now = Date.now()) => {
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return now - createdAtMs > ROOM_TTL_MS;
};

let memoryCreateLog: number[] = [];
const readCreateLog = (): number[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return memoryCreateLog;

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is number => typeof item === 'number');
  } catch {
    return memoryCreateLog;
  }
};

const assertCreateRateLimit = () => {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const recent = readCreateLog().filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_ROOMS) {
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - recent[0]);
    const waitMin = Math.max(1, Math.ceil(waitMs / 60000));

    throw new RealtimeRoomError('ERR_RATE_LIMITED', `방을 너무 자주 만들었어요. ${waitMin}분 뒤에 다시 시도해 주세요.`);
  }

  memoryCreateLog = [...recent, now];
  try { window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(memoryCreateLog)); }
  catch { /* Server rate limiting remains authoritative when storage is blocked. */ }
};

export async function createRoom<T>(
  gameType: RealtimeGameType,
  state: T,
  options?: { name?: string; maxCapacity?: number }
) {
  assertCreateRateLimit();
  const actorId = await getServerActor().catch(() => `anon-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`);
  try {
    const response = await realtimeRequest<RoomSession & { room: RoomSnapshot<T> }>('/rooms', {
      gameType,
      actorId,
      state: { ...state, lastActor: actorId },
      name: sanitizeRoomName(options?.name, gameType),
      maxCapacity: sanitizeMaxCapacity(options?.maxCapacity),
    });
    if (!isRoomSnapshot(response.room)) throw new RealtimeError('INVALID_RESPONSE');
    saveSession(response.room.id, response);
    return response.room;
  } catch (error) {
    throw new Error(roomErrorMessage(error instanceof RealtimeError ? error.code : null) ?? '방을 만들지 못했어요.');
  }
}
export async function getRoom<T>(roomId: string) {
  const room = await realtimeRequest<RoomSnapshot<T>>('/rooms/' + roomId);
  if (!isRoomSnapshot(room)) throw new RealtimeError('INVALID_RESPONSE');
  return room;
}
export async function assertJoinableRoom(roomId: string, gameType: RealtimeGameType) {
  try {
    const room = await getRoom(roomId);
    if (room.gameType !== gameType) throw new RealtimeError('GAME_TYPE_MISMATCH');
    return room;
  } catch (error) {
    throw new Error(
      roomErrorMessage(error instanceof RealtimeError ? error.code : null) ?? '방 정보를 불러오지 못했어요.'
    );
  }
}

