import Image from 'next/image';
import BubbleContainer from '@/components/BubbleContainer';
import Lottery from '@/components/Lottery';
import UniqueText from '@/components/UniqueText';
import { getDoubleDigitFormat } from '@/lib/utils/format';
import useDeck, { ContainerProps } from '@/lib/hooks/useDeck';

import passImage from '@/public/coffee/coffee_pass.svg';
import boomImage from '@/public/coffee/coffee_boom.svg';
import animation from '../animation.module.css';

const CardContainer = ({ children }: ContainerProps) => (
  <div className="w-full flex items-center justify-evenly">{children}</div>
);

interface SecondLoadingProps {
  cnt: number;
  result: string;
  changed: boolean;
}

const SecondLoading = ({ cnt, result = '', changed = false }: SecondLoadingProps) => {
  const resultText = changed ? `${result}번~~~!` : '커피를 쏠 사람은 바로~~';

  const gridCards = useDeck({
    cnt,
    Group: CardContainer,
    getCard: (i: number) => {
      const isBoom = result.includes(`${i}`);
      const isAnimationTriggered = changed && isBoom;

      const resultImg = isBoom ? (
        <Image priority src={boomImage} alt="boom" width={80} height={95} className="w-[4.5rem] h-22" />
      ) : (
        <Image priority src={passImage} alt="pass" width={52} height={95} className="w-12 h-22" />
      );
      return (
        <Lottery
          key={i}
          className={isAnimationTriggered ? animation['bounce-in'] : ''}
          type="front"
          cnt={getDoubleDigitFormat(i)}
        >
          {resultImg}
        </Lottery>
      );
    },
  });

  return (
    <article>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          {resultText}
        </UniqueText>
      </BubbleContainer>

      <div className="flex flex-col justify-center align-center mb-16 mt-6 min-h-[20rem]">{gridCards} </div>
    </article>
  );
};

export default SecondLoading;
