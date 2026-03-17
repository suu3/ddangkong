import { useContext, useMemo, useState } from 'react';

import useStep from '@/lib/hooks/useStep';
import { useRouter } from 'next/navigation';

import { COFFEE_RESULT } from '@/lib/constants/serviceUrls';
import { CoffeeContext } from '@/lib/context/coffee';
import { getLottery } from '@/lib/utils/random';
import FirstLoading from './FirstLoading';
import SecondLoading from './SecondLoading';
import { useTimeout } from '@/lib/hooks/useTimeout';
import { LOTTERY_SCALE_ANIMATION_TIME, RESULT_TRANSITION_TIME } from '@/lib/constants/coffee';

interface LoadingProps {
  resultValue?: string | null;
  roomId?: string | null;
  role?: 'host' | 'viewer';
  isRealtimeEnabled?: boolean;
}

const Loading = ({ resultValue, roomId, role, isRealtimeEnabled }: LoadingProps) => {
  const {
    allMuteState: { isAllMuted },
  } = useContext(CoffeeContext);

  const [step, Container, handleStep] = useStep(0);
  const [changed, setChanged] = useState(false);

  const router = useRouter();
  const {
    orderState: { boom, total },
  } = useContext(CoffeeContext);
  const randomResult = useMemo(() => {
    if (isRealtimeEnabled) {
      return resultValue ?? '';
    }

    return getLottery(total, boom).join(',');
  }, [boom, isRealtimeEnabled, resultValue, total]);

  useTimeout(() => {
    handleStep('next');
  }, RESULT_TRANSITION_TIME);

  useTimeout(() => {
    setChanged(true);
  }, RESULT_TRANSITION_TIME * 2);

  useTimeout(
    () => {
      if (isRealtimeEnabled && !randomResult) return;

      const searchParams = new URLSearchParams({
        boom: randomResult,
        muted: String(isAllMuted),
      });

      if (roomId) searchParams.set('roomId', roomId);
      if (role) searchParams.set('role', role);

      router.push(`${COFFEE_RESULT}?${searchParams.toString()}`);
    },
    RESULT_TRANSITION_TIME * 2 + LOTTERY_SCALE_ANIMATION_TIME + 400 * boom + 500 // 앞선 애니메이션 시간 +  scale&fadeout 시간 + 1000: 딜레이
  );

  return (
    <div className="relative bg-white flex flex-col items-center justify-center top-0 left-0 right-0 bottom-0">
      <Container curStep={step}>
        <FirstLoading />
        <SecondLoading result={randomResult} cnt={total} changed={changed} />
      </Container>
    </div>
  );
};

export default Loading;
