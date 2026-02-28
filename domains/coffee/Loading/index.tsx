import { useContext, useEffect, useMemo, useState } from 'react';

import useStep from '@/lib/hooks/useStep';
import { useRouter, useSearchParams } from 'next/navigation';

import { COFFEE_RESULT } from '@/lib/constants/serviceUrls';
import { CoffeeContext } from '@/lib/context/coffee';
import { getLottery } from '@/lib/utils/random';
import FirstLoading from './FirstLoading';
import SecondLoading from './SecondLoading';
import { useTimeout } from '@/lib/hooks/useTimeout';
import { LOTTERY_SCALE_ANIMATION_TIME, RESULT_TRANSITION_TIME } from '@/lib/constants/coffee';
import { getRoom, updateRoomState } from '@/lib/realtime/rooms';
import { subscribeRoomState } from '@/lib/realtime/channel';
import { CoffeeRealtimeState } from '@/lib/realtime/types';

const Loading = () => {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const role = (searchParams.get('role') as 'host' | 'viewer') ?? 'host';
  const isHost = role !== 'viewer';

  const {
    allMuteState: { isAllMuted },
  } = useContext(CoffeeContext);

  const [step, Container, handleStep] = useStep(0);
  const [changed, setChanged] = useState(false);
  const [syncedResult, setSyncedResult] = useState<string | null>(null);

  const router = useRouter();
  const {
    orderState: { boom, total },
  } = useContext(CoffeeContext);
  const randomResult = useMemo(() => getLottery(total, boom).join(','), [total, boom]);

  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    getRoom<CoffeeRealtimeState>(roomId).then(room => {
      if (!mounted || !room?.game_state?.resultBoom) return;
      setSyncedResult(room.game_state.resultBoom);
    });

    const unsubscribe = subscribeRoomState<CoffeeRealtimeState>({
      roomId,
      onState: state => {
        if (!mounted || !state?.resultBoom) return;
        setSyncedResult(state.resultBoom);
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !isHost) return;

    getRoom<CoffeeRealtimeState>(roomId).then(room => {
      if (!room) return;

      const nextState: CoffeeRealtimeState = {
        ...room.game_state,
        resultBoom: room.game_state.resultBoom ?? randomResult,
      };

      if (room.game_state.resultBoom) {
        setSyncedResult(room.game_state.resultBoom);
        return;
      }

      updateRoomState(roomId, nextState).then(updated => {
        if (updated?.game_state?.resultBoom) {
          setSyncedResult(updated.game_state.resultBoom);
        }
      });
    });
  }, [isHost, randomResult, roomId]);

  const finalResult = roomId ? syncedResult : randomResult;

  useTimeout(() => {
    handleStep('next');
  }, RESULT_TRANSITION_TIME);

  useTimeout(() => {
    setChanged(true);
  }, RESULT_TRANSITION_TIME * 2);

  useEffect(() => {
    if (!finalResult) return;

    const timer = setTimeout(() => {
      router.push(`${COFFEE_RESULT}?boom=${finalResult}&muted=${isAllMuted}`);
    }, RESULT_TRANSITION_TIME * 2 + LOTTERY_SCALE_ANIMATION_TIME + 400 * boom + 500);

    return () => clearTimeout(timer);
  }, [boom, finalResult, isAllMuted, router]);

  return (
    <div className="relative bg-white flex flex-col items-center justify-center top-0 left-0 right-0 bottom-0">
      <Container curStep={step}>
        <FirstLoading />
        <SecondLoading result={finalResult ?? ''} cnt={total} changed={changed} />
      </Container>
    </div>
  );
};

export default Loading;
