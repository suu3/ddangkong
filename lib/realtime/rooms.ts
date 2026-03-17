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

const getDefaultRoomName = (gameType: RealtimeGameType) => {
  if (gameType === 'coffee') return '커피내기 방';
  if (gameType === 'roulette') return '룰렛 방';
  if (gameType === 'hot_potato') return '폭탄 돌리기 방';
  return '팀 나누기 방';
};

export const createRoom = async <T>(
  gameType: RealtimeGameType,
  gameState: T,
  options?: { name?: string; maxCapacity?: number }
) => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    status: 'active',
    game_type: gameType,
    name: options?.name || getDefaultRoomName(gameType),
    max_capacity: options?.maxCapacity || 10,
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
      throw new Error(
        `Failed to create room: RLS policy blocked insert for game_type="${gameType}". ` +
          `Allow this game_type in your rooms INSERT policy (e.g. game_type in ('coffee','roulette','hot_potato','team_split')).`
      );
    }

    throw new Error(`Failed to create room: ${error.message}`);
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
