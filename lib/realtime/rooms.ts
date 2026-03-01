import { supabase } from '@/lib/supabase/client';

interface RoomRow<T> {
  id: string;
  status: string;
  game_type: string;
  title: string | null;
  max_players: number | null;
  game_state: T;
  created_at: string;
}

interface RealtimeStateWithRevision {
  revision?: number;
}

export const createRoom = async <T>(
  gameType: 'coffee' | 'roulette',
  gameState: T,
  options?: { title?: string; maxPlayers?: number }
) => {
  const id = crypto.randomUUID();
  const basePayload = {
    id,
    status: 'active',
    game_type: gameType,
    game_state: gameState,
  };

  // 컬럼 존재 여부를 미리 알 수 없으므로, 일단 포함해서 시도
  const { data, error } = await supabase
    .from('rooms')
    .insert([
      {
        ...basePayload,
        title: options?.title || `${gameType === 'coffee' ? '커피내기' : '룰렛'} 방`,
        max_players: options?.maxPlayers || 10,
      },
    ])
    .select()
    .single();

  if (error) {
    // 만약 컬럼이 없어서 에러가 난 경우(PGRST204 등), 기본 필드만으로 재시도
    if (error.message.includes('column') || error.code === 'PGRST204') {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('rooms')
        .insert([basePayload])
        .select()
        .single();

      if (fallbackError) throw new Error(`Failed to create room (fallback): ${fallbackError.message}`);
      return fallbackData as RoomRow<T>;
    }
    throw new Error(`Failed to create room: ${error.message}`);
  }

  return data as RoomRow<T>;
};

export const getRoom = async <T>(roomId: string) => {
  // getRoom에서도 존재하지 않을 수 있는 컬럼은 에러가 날 수 있으므로 주의
  const { data, error } = await supabase
    .from('rooms')
    .select('*') // 모든 컬럼 조회 (없으면 무시됨)
    .eq('id', roomId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch room: ${error.message}`);
  }

  return data as RoomRow<T>;
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

  const { data, error } = await query.select().single();

  if (error) {
    if (error.code === 'PGRST116' && typeof expectedRevision === 'number') {
      throw new Error('Realtime conflict: stale revision');
    }
    throw new Error(`Failed to update room state: ${error.message}`);
  }

  return data as RoomRow<T>;
};
