import { getSupabaseConfig } from '@/lib/supabase/env';

type Unsubscribe = () => void;

interface SubscribeOptions<T> {
  roomId: string;
  onState: (state: T) => void;
  onError?: (message: string) => void;
}

export const subscribeRoomState = <T>({ roomId, onState, onError }: SubscribeOptions<T>): Unsubscribe => {
  const config = getSupabaseConfig();

  if (!config) {
    onError?.('Supabase environment variables are missing.');
    return () => {};
  }

  const url = new URL(config.url);
  const socketUrl = `wss://${url.host}/realtime/v1/websocket?apikey=${config.publishableKey}&vsn=1.0.0`;
  const topic = `realtime:public:rooms:id=eq.${roomId}`;
  const socket = new WebSocket(socketUrl);

  let heartbeatRef = 2;
  const heartbeatInterval = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(
      JSON.stringify({
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref: String(heartbeatRef++),
      })
    );
  }, 30000);

  socket.addEventListener('open', () => {
    socket.send(
      JSON.stringify({
        topic,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { self: false },
            presence: { key: '' },
            postgres_changes: [
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'rooms',
                filter: `id=eq.${roomId}`,
              },
            ],
          },
        },
        ref: '1',
      })
    );
  });

  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data?.event === 'postgres_changes' && data?.payload?.data?.record?.game_state) {
      onState(data.payload.data.record.game_state as T);
    }

    if (data?.event === 'phx_error') {
      onError?.('Realtime channel error');
    }
  });

  socket.addEventListener('error', () => {
    onError?.('Failed to connect realtime channel');
  });

  return () => {
    clearInterval(heartbeatInterval);

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          topic,
          event: 'phx_leave',
          payload: {},
          ref: String(heartbeatRef++),
        })
      );
    }

    socket.close();
  };
};
