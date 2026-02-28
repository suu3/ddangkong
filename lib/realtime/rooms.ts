import { getSupabaseConfig } from '@/lib/supabase/env';

interface RoomRow<T> {
  id: string;
  status: string;
  game_type: string;
  game_state: T;
  created_at: string;
}

interface RealtimeStateWithRevision {
  revision?: number;
}

const getHeaders = () => {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error('Supabase environment variables are missing.');
  }

  return {
    apikey: config.publishableKey,
    Authorization: `Bearer ${config.publishableKey}`,
    'Content-Type': 'application/json',
  };
};

export const createRoom = async <T>(gameType: 'coffee' | 'roulette', gameState: T) => {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase environment variables are missing.');

  const id = crypto.randomUUID();
  const response = await fetch(`${config.url}/rest/v1/rooms`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      Prefer: 'return=representation',
    },
    body: JSON.stringify([
      {
        id,
        status: 'active',
        game_type: gameType,
        game_state: gameState,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`Failed to create room: ${response.status}`);
  }

  const data = (await response.json()) as RoomRow<T>[];
  return data[0];
};

export const getRoom = async <T>(roomId: string) => {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase environment variables are missing.');

  const response = await fetch(
    `${config.url}/rest/v1/rooms?id=eq.${roomId}&select=id,status,game_type,game_state,created_at&limit=1`,
    {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch room: ${response.status}`);
  }

  const data = (await response.json()) as RoomRow<T>[];
  return data[0] ?? null;
};

export const updateRoomState = async <T extends RealtimeStateWithRevision>(
  roomId: string,
  gameState: T,
  expectedRevision?: number
) => {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase environment variables are missing.');

  const revisionFilter =
    typeof expectedRevision === 'number'
      ? `&game_state->>revision=eq.${encodeURIComponent(String(expectedRevision))}`
      : '';

  const response = await fetch(`${config.url}/rest/v1/rooms?id=eq.${roomId}${revisionFilter}`, {
    method: 'PATCH',
    headers: {
      ...getHeaders(),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      game_state: gameState,
      status: 'active',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update room state: ${response.status}`);
  }

  const data = (await response.json()) as RoomRow<T>[];

  if (typeof expectedRevision === 'number' && !data[0]) {
    throw new Error('Realtime conflict: stale revision');
  }

  return data[0] ?? null;
};
