import { supabase } from '@/lib/supabase/client';

interface RoomRow<T> {
  id: string;
  status: string;
  game_type: string;
  title: string | null;
  max_players?: number | null;
  game_state: T;
  created_at: string;
}

interface RealtimeStateWithRevision {
  revision?: number;
}

const isMissingColumnError = (message: string | undefined, code: string | undefined, column: string) => {
  if (!message) return false;
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    message.includes(`'${column}'`) ||
    message.toLowerCase().includes('column')
  );
};

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

  // max_players가 없는 스키마도 있으므로 우선 포함 시도 후 실패하면 자동 폴백
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
    if (isMissingColumnError(error.message, error.code, 'max_players')) {
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
  const { data, error } = await supabase
    .from('rooms')
    .select('id,status,game_type,title,max_players,game_state,created_at')
    .eq('id', roomId)
    .single();

  if (error) {
    if (isMissingColumnError(error.message, error.code, 'max_players')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('rooms')
        .select('id,status,game_type,title,game_state,created_at')
        .eq('id', roomId)
        .single();

      if (fallbackError) {
        if (fallbackError.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch room: ${fallbackError.message}`);
      }

      return { ...(fallbackData as RoomRow<T>), max_players: null };
    }

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
