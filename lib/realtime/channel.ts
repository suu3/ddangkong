import { supabase } from '@/lib/supabase/client';

type Unsubscribe = () => void;

interface SubscribeOptions<T> {
  roomId: string;
  onState: (state: T) => void;
  onError?: (message: string) => void;
}

export const subscribeRoomState = <T>({
  roomId,
  onState,
  onError,
}: SubscribeOptions<T>): { unsubscribe: Unsubscribe; sendState: (state: T) => void } => {
  const channel = supabase
    .channel(`room:${roomId}`, {
      config: {
        broadcast: { self: true }, // 내가 보낸 메시지도 내가 받아서 상태 업데이트
      },
    })
    // 1. DB 변경 감지 (백업용)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload: any) => {
        if (payload.new && (payload.new as any).game_state) {
          onState(payload.new.game_state as T);
        }
      }
    )
    // 2. Broadcast 감지 (진짜 실시간 - WebRTC 대용)
    .on('broadcast', { event: 'state_change' }, (data: any) => {
      const { payload } = data;
      onState(payload as T);
    })
    .subscribe((status: string, error?: Error) => {
      if (status === 'CHANNEL_ERROR' || error) {
        onError?.(error?.message || 'Realtime channel error');
      }
    });

  const sendState = (state: T) => {
    void channel.send({
      type: 'broadcast',
      event: 'state_change',
      payload: state,
    });
  };

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
    sendState,
  };
};
