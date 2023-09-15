import { MutableRefObject, ReactNode, useEffect, useRef, useState } from 'react';
import BubbleContainer from '@/components/BubbleContainer';
import MainButton from '@/components/button/MainButton';
import UniqueText from '@/components/UniqueText';
import useDeck from '@/lib/hooks/useDeck';
import Lottery from '@/components/Lottery';
import { getDoubleDigitFormat } from '@/lib/utils/format';
import { CSSTransition, TransitionGroup } from 'react-transition-group';

import animation from './animation.module.css';
import clsx from 'clsx';
import { getRandomInteger } from '@/lib/utils/random';
import { useDidUpdate } from '@/lib/hooks/useDidUpdate';

interface ShuffleProps {
  handleStep: (type: 'next' | 'prev') => void;
  cnt: number;
}

const CardContainer = ({ children }: { children: ReactNode }) => <div className="flex justify-evenly">{children}</div>;

export default function Shuffle({ handleStep, cnt }: ShuffleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<Array<HTMLDivElement | null>>([]);

 
  const [shuffle, setShuffle] = useState(false); // 셔플 상태를 관리하기 위한 상태 추가
  const handleShuffle = () => {
    setShuffle(prev => !prev); // 셔플 버튼 클릭 시 셔플 상태를 true로 설정
    // setTimeout(() => {
    //   setShuffle(false); // 2초 뒤에 셔플 상태를 false로 설정하여 애니메이션이 다시 실행되도록 함
    // }, 2000);
  };


  const shuffleAnimation= (direction: string, boxRef: MutableRefObject<(HTMLDivElement | null)[]>, targetX: number, targetY: number, cnt:number) =>{
    boxRef?.current?.forEach((item: HTMLDivElement | null, index: number) => {
      if(!item) return;
      const {
        x: childX,
        y: childY,
        height: childHeight,
        width: childWidth
      } = item?.getBoundingClientRect();

      const distanceX = childX + childWidth / 2;
      const distanceY = childY + childHeight / 2;
     
      let transitionArray : {
        transform: string;
      }[] = [];

      switch (direction){
        case 'front':
          transitionArray = [
            { transform: "translate(0px)" },
            {
              transform: `translate(${targetX - distanceX}px,${
                targetY - distanceY
              }px)`
            }
          ]
        case 'back' :
          transitionArray = [
            {
              transform: `translate(${targetX - distanceX}px,${
                targetY - distanceY
              }px)`
            },
            { transform: "translate(0px)" }
          ]
      }
      
      item.animate(
        transitionArray,
        {
          // timing options
          duration: 2000,
          delay: (index * 2000) / cnt,
          fill: "forwards",
          easing: "cubic-bezier(.32,2,.55,.27)"
        }
      );
    });
  }
  
  const divs = useDeck({
    cnt,
    Group: CardContainer,
    getCard: (i: number) => {
      return (
        <Lottery
          key={i}
          ref={(el) => (boxRef.current[i] = el)} 
          className={clsx()}
        >
          {getDoubleDigitFormat(i)}
        </Lottery>
      );
    },
  });

  useDidUpdate(() => {
    const container = containerRef.current;
    if (container && boxRef?.current) {
      const {
        x,
        y,
        height,
        width
      } = container?.getBoundingClientRect();

      const targetX = x + width / 2;
      const targetY = y + height / 2;

     
      shuffleAnimation('front', boxRef, targetX, targetY, cnt);

      // setTimeout(() => {
      //   shuffleAnimation('back', boxRef, targetX, targetY, cnt);
      // }, 4000);
    }
  }, [shuffle, cnt]);

  return (
    <>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          각자의 번호를 골라주세요~
        </UniqueText>
      </BubbleContainer>

      <div ref={containerRef} className="flex flex-col justify-center align-center mb-16 mt-6 min-h-[20rem] relative">{divs} </div>
      <div className="flex gap-2">
        <MainButton
          // disabled={shuffle}
          label="순서 섞기"
          variant="outlined"
          color="chocolate"
          onClick={handleShuffle}
        />
        <MainButton label="결과 확인" variant="contained" color="chocolate" onClick={() => handleStep('next')} />
      </div>
    </>
  );
}
