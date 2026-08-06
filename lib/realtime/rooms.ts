import { supabase } from '@/lib/supabase/client';

interface RoomRow<T> {
  id: string;
  status: string;
  game_type: string;
  name: string | null;
  max_capacity: number | null;
  game_state: T;
  created_at: string;
}

interface RealtimeStateWithRevision {
  revision?: number;
}

export type RealtimeGameType = 'coffee' | 'roulette' | 'hot_potato' | 'team_split';

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

const GAME_TYPES: RealtimeGameType[] = ['coffee', 'roulette', 'hot_potato', 'team_split'];

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

const readCreateLog = (): number[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is number => typeof item === 'number');
  } catch {
    return [];
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

  window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify([...recent, now]));
};

export const createRoom = async <T>(
  gameType: RealtimeGameType,
  gameState: T,
  options?: { name?: string; maxCapacity?: number }
) => {
  if (!GAME_TYPES.includes(gameType)) {
    throw new RealtimeRoomError('ERR_INVALID_GAME_TYPE', '지원하지 않는 게임이라 방을 만들 수 없어요.');
  }

  assertCreateRateLimit();

  const id = crypto.randomUUID();
  const payload = {
    id,
    status: 'active',
    game_type: gameType,
    name: sanitizeRoomName(options?.name, gameType),
    max_capacity: sanitizeMaxCapacity(options?.maxCapacity),
    game_state: gameState,
  };

  const { data, error } = await supabase
    .from('rooms')
    .insert([payload])
    .select('id,status,game_type,name,max_capacity,game_state,created_at')
    .single();

  if (error) {
    const looksLikeRlsError =
      error.code === '42501' ||
      error.message.toLowerCase().includes('row-level security') ||
      error.message.toLowerCase().includes('permission denied');

    if (looksLikeRlsError) {
      throw new RealtimeRoomError(
        'ERR_RLS_BLOCKED',
        '방 생성 권한이 없어요. 잠시 후 다시 시도해 주세요.',
        `RLS policy blocked insert for game_type="${gameType}". ` +
          `Allow this game_type in your rooms INSERT policy (e.g. game_type in (${GAME_TYPES.map(
            type => `'${type}'`
          ).join(',')})).`
      );
    }

    throw new RealtimeRoomError(
      'ERR_CREATE_FAILED',
      '방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
      error.message
    );
  }

  return data as RoomRow<T>;
};

export const getRoom = async <T>(roomId: string) => {
  const { data, error } = await supabase
    .from('rooms')
    .select('id,status,game_type,name,max_capacity,game_state,created_at')
    .eq('id', roomId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new RealtimeRoomError('ERR_FETCH_FAILED', '방 정보를 불러오지 못했어요.', error.message);
  }

  return data as RoomRow<T>;
};

/** 방 참여 전 유효성 확인용. 없거나 만료/종료된 방이면 사용자용 메시지와 함께 실패합니다. */
export const assertJoinableRoom = async (roomId: string, gameType: RealtimeGameType) => {
  const room = await getRoom<unknown>(roomId);

  if (!room) {
    throw new RealtimeRoomError('ERR_ROOM_NOT_FOUND', '존재하지 않는 방 ID예요. 다시 확인해 주세요.');
  }

  if (room.game_type !== gameType) {
    throw new RealtimeRoomError(
      'ERR_GAME_TYPE_MISMATCH',
      `'${getGameLabel(room.game_type as RealtimeGameType)}' 방 ID예요. 해당 게임 화면에서 참여해 주세요.`
    );
  }

  if (room.status !== 'active' || isRoomExpired(room.created_at)) {
    throw new RealtimeRoomError('ERR_ROOM_EXPIRED', '이미 종료되었거나 만료된 방이에요. 새 방을 만들어 주세요.');
  }

  return room;
};

export const updateRoomState = async <T extends RealtimeStateWithRevision>(
  roomId: string,
  gameState: T,
  expectedRevision?: number
) => {
  let query = supabase.from('rooms').update({
    game_state: gameState,
    status: 'active',
  });

  query = query.eq('id', roomId);

  if (typeof expectedRevision === 'number') {
    query = query.eq('game_state->>revision', String(expectedRevision));
  }

  const { data, error } = await query.select('id,status,game_type,name,max_capacity,game_state,created_at').single();

  if (error) {
    if (error.code === 'PGRST116' && typeof expectedRevision === 'number') {
      throw new Error('Realtime conflict: stale revision');
    }

    throw new RealtimeRoomError('ERR_UPDATE_FAILED', '방 상태를 저장하지 못했어요.', error.message);
  }

  return data as RoomRow<T>;
};
