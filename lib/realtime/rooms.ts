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
  const { data, error } = await supabase
    .from('rooms')
    .insert([
      {
        id,
        status: 'active',
        game_type: gameType,
        title: options?.title || `${gameType === 'coffee' ? '커피내기' : '룰렛'} 방`,
        max_players: options?.maxPlayers || 10,
        game_state: gameState,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create room: ${error.message}`);
  }

  return data as RoomRow<T>;
};

export const getRoom = async <T>(roomId: string) => {
  const { data, error } = await supabase
    .from('rooms')
    .select('id,status,game_type,game_state,created_at')
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
