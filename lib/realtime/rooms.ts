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

export const createRoom = async <T>(
  gameType: 'coffee' | 'roulette',
  gameState: T,
  options?: { name?: string; maxCapacity?: number }
) => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    status: 'active',
    game_type: gameType,
    name: options?.name || `${gameType === 'coffee' ? '커피내기' : '룰렛'} 방`,
    max_capacity: options?.maxCapacity || 10,
    game_state: gameState,
  };

  const { data, error } = await supabase
    .from('rooms')
    .insert([payload])
    .select('id,status,game_type,name,max_capacity,game_state,created_at')
    .single();

  if (error) throw new Error(`Failed to create room: ${error.message}`);
  return data as RoomRow<T>;
};

export const getRoom = async <T>(roomId: string) => {
  const { data, error } = await supabase
    .from('rooms')
    .select('id,status,game_type,name,max_capacity,game_state,created_at')
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

  const { data, error } = await query.select('id,status,game_type,name,max_capacity,game_state,created_at').single();

  if (error) {
    if (error.code === 'PGRST116' && typeof expectedRevision === 'number') {
      throw new Error('Realtime conflict: stale revision');
    }
    throw new Error(`Failed to update room state: ${error.message}`);
  }

  return data as RoomRow<T>;
};
