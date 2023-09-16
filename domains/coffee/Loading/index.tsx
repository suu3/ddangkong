import { useContext, useState } from 'react';

import useStep from '@/lib/hooks/useStep';
import { useRouter } from 'next/navigation';

import { COFFEE_RESULT } from '@/lib/constants/serviceUrls';
import { CoffeContext } from '@/lib/context/coffee';
import { getLottery } from '@/lib/utils/random';
import FirstLoading from './FirstLoading';
import SecondLoading from './SecondLoading';
import { useTimeout } from '@/lib/hooks/useTimeout';

const Loading = () => {
  const TRANSITION_TIME = 1500;

  const [step, Container, handleStep] = useStep(0);
  const [changed, setChanged] = useState(false);
  const router = useRouter();
  const {
    orderState: { boom, total },
  } = useContext(CoffeContext);
  const randomResult = getLottery(total, boom).join(',');

  useTimeout(() => {
    handleStep('next');
  }, TRANSITION_TIME);

  useTimeout(() => {
    setChanged(true);
  }, TRANSITION_TIME * 2);

  useTimeout(() => {
    router.push(`${COFFEE_RESULT}?boom=${randomResult}`);
  }, TRANSITION_TIME * 3);

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
