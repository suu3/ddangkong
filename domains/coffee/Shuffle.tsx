import { ReactNode, RefObject, useState, useRef } from 'react';
import clsx from 'clsx';
import BubbleContainer from '@/components/BubbleContainer';
import MainButton from '@/components/button/MainButton';
import UniqueText from '@/components/UniqueText';
import Lottery from '@/components/Lottery';
import useDeck, { ContainerProps } from '@/lib/hooks/useDeck';
import { getDoubleDigitFormat } from '@/lib/utils/format';

interface ShuffleProps {
  handleStep: (type: 'next' | 'prev') => void;
  cnt: number;
}

type Location = [number, number][];

const CardContainer = ({ children }: ContainerProps) => <div className="flex justify-evenly">{children}</div>;

export default function Shuffle({ handleStep, cnt }: ShuffleProps) {
  const ANIMATION_DURATION = 2500 + cnt * 100;
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<Array<HTMLDivElement | null>>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [firstLocation, setFirstLocation] = useState(Array.from({ length: cnt }).map(() => [0, 0]));

  const onClickShuffle = () => {
    setIsShuffling(true);
    setTimeout(() => {
      setIsShuffling(false);
    }, ANIMATION_DURATION + 100);

    triggerShuffle(containerRef, boxRef);
  };

  const triggerShuffle = (containerRef: RefObject<HTMLDivElement>, boxRef: RefObject<(HTMLDivElement | null)[]>) => {
    const container = containerRef.current;
    const box = boxRef.current;

    if (container && box) {
      const { x, y, height, width } = container.getBoundingClientRect();

      const targetX = x + width / 2;
      const targetY = y + height / 2;

      let moveDistances: Location = [];
      let returnDistances: Location = [];

      box.forEach((item: HTMLDivElement | null, index: number) => {
        if (!item) return;

        const { x: childX, y: childY, height: childHeight, width: childWidth } = item?.getBoundingClientRect();

        const distanceX = childX + childWidth / 2;
        const distanceY = childY + childHeight / 2;

        moveDistances.push([targetX - distanceX, targetY - distanceY]);
        returnDistances.push([-(targetX - distanceX), -(targetY - distanceY)]);
      });

      //random sort
      returnDistances.sort((a, b) => {
        return Math.random() - 0.5;
      });

      box.forEach((item: HTMLDivElement | null, index: number) => {
        if (!item) return;

        const [firstX, firstY] = firstLocation[index - 1];
        const [moveX, moveY] = moveDistances[index - 1];
        const [returnX, returnY] = returnDistances[index - 1];

        item.animate(
          {
            transform: [
              `translate(${firstX}px, ${firstY}px)`,
              `translate(${firstX + moveX}px, ${firstY + moveY}px)`,
              `translate(${firstX + moveX}px, ${firstY + moveY}px)`,
              `translate(${firstX + moveX + returnX}px, ${firstY + moveY + returnY}px)`,
            ],
            easing: ['cubic-bezier(0.68,-.55,.265,1.55)'],
            offset: [0, 0.3, 0.7, 1],
          },
          {
            delay: (index * 1500) / 9,
            duration: ANIMATION_DURATION,
            fill: 'forwards',
          }
        );
      });

      /**
       * Card의 위치를 random으로 바꿀 때, 이동한 위치에서 새로운 거리계산은 가능하지만 transform 속성은 바뀌지 않는다.
       * 따라서 처음의 위치를 useState로 저장해놓고, transform 할때마다 마지막 위치를 누적 시켜야 한다.
       */

      setFirstLocation(prev => {
        const temp = prev.map((_, index) => {
          const [firstX, firstY] = prev[index];
          const [moveX, moveY] = moveDistances[index];
          const [returnX, returnY] = returnDistances[index];
          return [firstX + moveX + returnX, firstY + moveY + returnY];
        });

        return temp;
      });
    }
  };

  const gridDivs = useDeck({
    cnt,
    Group: CardContainer,
    getCard: (i: number) => {
      return (
        <Lottery key={i} ref={el => (boxRef.current[i] = el)} className={clsx()}>
          {getDoubleDigitFormat(i)}
        </Lottery>
      );
    },
  });

  return (
    <>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          각자의 번호를 골라주세요~
        </UniqueText>
      </BubbleContainer>

      <div ref={containerRef} className="flex flex-col justify-center align-center mb-16 mt-6 min-h-[20rem] relative">
        {gridDivs}
      </div>
      <div className="flex gap-2 mb-10">
        <MainButton
          disabled={isShuffling}
          label="순서 섞기"
          variant="outlined"
          color="chocolate"
          onClick={onClickShuffle}
        />
        <MainButton label="결과 확인" variant="contained" color="chocolate" onClick={() => handleStep('next')} />
      </div>
    </>
  );
}
