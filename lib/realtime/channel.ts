import { subscribeConnectionState } from './connection';

type Unsubscribe = () => void;

interface SubscribeOptions<T> {
  roomId: string;
  onState: (state: T) => void;
}

/**
 * 방 상태를 구독한다. 접속 직후(재연결 포함) 현재 상태를 한 번 받고,
 * 이후에는 서버가 저장에 성공한 상태만 broadcast로 받는다.
 */
export const subscribeRoomState = <T>({ roomId, onState }: SubscribeOptions<T>): { unsubscribe: Unsubscribe } => {
  const unsubscribe = subscribeConnectionState(roomId, state => onState(state as T));

  return { unsubscribe };
};
