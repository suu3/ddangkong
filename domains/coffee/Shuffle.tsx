import { ReactNode, RefObject, useRef } from 'react';
import clsx from 'clsx';
import BubbleContainer from '@/components/BubbleContainer';
import MainButton from '@/components/button/MainButton';
import UniqueText from '@/components/UniqueText';
import Lottery from '@/components/Lottery';
import useDeck from '@/lib/hooks/useDeck';
import { getDoubleDigitFormat } from '@/lib/utils/format';

interface ShuffleProps {
  handleStep: (type: 'next' | 'prev') => void;
  cnt: number;
}

const CardContainer = ({ children }: { children: ReactNode }) => <div className="flex justify-evenly">{children}</div>;

export default function Shuffle({ handleStep, cnt }: ShuffleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<Array<HTMLDivElement | null>>([]);

  const onClickShuffle = () => {
    triggerShuffle(containerRef, boxRef);
  };

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
              'translate(0px)',
              `translate(${targetX - distanceX}px,${targetY - distanceY}px)`,
              `translate(${targetX - distanceX}px,${targetY - distanceY}px)`,
              'translate(0px)',
            ],
            easing: ['cubic-bezier(0.68,-.55,.265,1.55)'],
            offset: [0, 0.3, 0.7, 1],
          },
          {
            delay: (index * 1500) / 9,
            duration: 2500 + cnt * 100,
          }
        );
      });
    }
  };

  const divs = useDeck({
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
        {divs}
      </div>
      <div className="flex gap-2 mb-10">
        <MainButton label="순서 섞기" variant="outlined" color="chocolate" onClick={onClickShuffle} />
        <MainButton label="결과 확인" variant="contained" color="chocolate" onClick={() => handleStep('next')} />
      </div>
    </>
  );
}
