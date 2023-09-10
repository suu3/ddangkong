import { useEffect } from 'react';
import BubbleContainer from '@/components/BubbleContainer';
import Lottery from '@/components/Lottery';
import UniqueText from '@/components/UniqueText';
import useDeck from '@/lib/hooks/useDeck';
import useStep from '@/lib/hooks/useStep';
import { getDoubleDigitFormat } from '@/lib/utils/format';
import loadingImage from '@/public/coffee/loading.gif';
import Image from 'next/image';
import { HandleStep } from '@/lib/hooks/useStep';
import { useRouter } from 'next/navigation';

import passImage from '@/public/coffee/coffee_pass.svg';
import boomImage from '@/public/coffee/coffee_boom.svg';

const TRANSITION_TIME = 1500;

const FirstLoading = ({ handleStep }: { handleStep: HandleStep }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      handleStep('next');
    }, TRANSITION_TIME);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <article className="flex flex-col min-h-[36rem] items-center justify-center">
      <div className="flex">
        <UniqueText font="sans" Tag="div" size="ml" className="mb-7">
          커피 만드는 중
        </UniqueText>
        <UniqueText font="sans" Tag="span" size="ml" className="animate-[pulse_2s_infinite_]">
          .
        </UniqueText>
        <UniqueText font="sans" Tag="span" size="ml" className="animate-[pulse_2s_infinite_400ms]">
          .
        </UniqueText>
        <UniqueText font="sans" Tag="span" size="ml" className="animate-[pulse_2s_infinite_800ms]">
          .
        </UniqueText>
      </div>
      <div className="relative h-44	w-24">
        <Image className="animate-pulse" src={loadingImage} fill alt="로딩 이미지" />
      </div>
    </article>
  );
};

const SecondLoading = ({ cnt }: { cnt: number }) => {
  const router = useRouter();
  const divs = useDeck({
    cnt,
    getCard: (i: number) => {
      return (
        <Lottery type="front" key={i} cnt={getDoubleDigitFormat(i)}>
          <Image src={passImage} alt="pass" width={52} height={95} />
        </Lottery>
      );
    },
  });

  useEffect(() => {
    const timer1 = setTimeout(() =>
      // 말풍선 변경
      {}, TRANSITION_TIME);

    const timer2 = setTimeout(() => {
      //   router.push('/coffee/result');
    }, TRANSITION_TIME * 2);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <article>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          커피를 쏠 사람은 바로~~
        </UniqueText>
      </BubbleContainer>

      <div className="flex flex-col justify-center align-center mb-16 mt-6 min-h-[20rem]">{divs} </div>
    </article>
  );
};

const Loading = () => {
  const [step, Container, handleStep] = useStep(0);

  return (
    <div className="relative bg-white flex flex-col items-center justify-center top-0 left-0 right-0 bottom-0">
      <Container curStep={step}>
        <FirstLoading handleStep={handleStep} />
        <SecondLoading cnt={12} />
      </Container>
    </div>
  );
};

export default Loading;
