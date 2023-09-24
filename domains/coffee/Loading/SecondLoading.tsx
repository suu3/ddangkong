import { RefObject, memo, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

import BubbleContainer from '@/components/BubbleContainer';
import Lottery from '@/components/Lottery';
import UniqueText from '@/components/UniqueText';
import { getDoubleDigitFormat } from '@/lib/utils/format';
import useDeck, { ContainerProps } from '@/lib/hooks/useDeck';

import passImage from '@/public/coffee/coffee_pass.svg';
import boomImage from '@/public/coffee/coffee_boom.svg';
import { useDidUpdate } from '@/lib/hooks/useDidUpdate';
import { LOTTERY_SCALE_ANIMATION_TIME, RESULT_TRANSITION_TIME } from '@/lib/constants/coffee';

const CardContainer = ({ children }: ContainerProps) => (
  <div className="w-full flex items-center justify-evenly">{children}</div>
);

interface SecondLoadingProps {
  cnt: number;
  result: string;
  changed: boolean;
}

const SecondLoading = ({ cnt, result = '', changed = false }: SecondLoadingProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<Array<HTMLDivElement | null>>([]);

  const resultText = changed ? `${result}번~~~!` : '커피를 쏠 사람은 바로~~';

  const triggerShuffle = (containerRef: RefObject<HTMLDivElement>, boxRef: RefObject<(HTMLDivElement | null)[]>) => {
    const container = containerRef.current;
    const box = boxRef.current;

    if (container && box) {
      const { x, y, height, width } = container.getBoundingClientRect();

      const targetX = x + width / 2;
      const targetY = y + height / 2;

      box.forEach((item: HTMLDivElement | null, index: number) => {
        if (!item) return;

        const { x: childX, y: childY, height: childHeight, width: childWidth } = item?.getBoundingClientRect();

        const distanceX = childX + childWidth / 2;
        const distanceY = childY + childHeight / 2;

        item.animate(
          {
            transform: [
              'translate(0px) scale(1)',
              `translate(${targetX - distanceX}px,${targetY - distanceY}px) scale(1.5)`,
            ],
            easing: ['linear'],
          },
          {
            duration: LOTTERY_SCALE_ANIMATION_TIME,
            fill: 'forwards',
          }
        );

        // 총 LOTTERY_SCALE_ANIMATION_TIME 만큼
        setTimeout(
          () => {
            if (!item) return;
            item.animate(
              {
                opacity: [1, 0],
                easing: ['cubic-bezier(1,.02,1,-0.08)'],
              },
              {
                duration: 400,
                fill: 'forwards',
              }
            );
          },
          LOTTERY_SCALE_ANIMATION_TIME + 400 * (box.length - index)
        );
      });
    }
  };

  useDidUpdate(() => {
    if (changed) triggerShuffle(containerRef, boxRef);
  }, [changed]);

  const gridCards = useDeck({
    cnt,
    Group: CardContainer,
    getCard: (i: number) => {
      const isBoom = result.split(',').includes(`${i}`);
      const isAnimationTriggered = changed && isBoom;

      const resultImg = isBoom ? (
        <Image priority src={boomImage} alt="boom" width={80} height={95} className="w-[4.5rem] h-22" />
      ) : (
        <Image priority src={passImage} alt="pass" width={52} height={95} className="w-12 h-22" />
      );
      return (
        <Lottery
          key={i}
          ref={el => {
            if (isAnimationTriggered) return (boxRef.current[boxRef.current.length] = el);
          }}
          style={
            isAnimationTriggered
              ? {
                  zIndex: 100 + i,
                }
              : {}
          }
        >
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: (RESULT_TRANSITION_TIME / 3) * 0.001 }}
          >
            <Lottery.Back>{getDoubleDigitFormat(i)}</Lottery.Back>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: (RESULT_TRANSITION_TIME / 3) * 0.001 }}
          >
            <Lottery.Front cnt={getDoubleDigitFormat(i)}>{resultImg}</Lottery.Front>
          </motion.div>
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

      <div ref={containerRef} className="flex flex-col justify-center align-center mb-16 mt-6 min-h-[20rem]">
        {gridCards}
      </div>
    </article>
  );
};

export default memo(SecondLoading);
