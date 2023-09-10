import { ReactNode, useEffect, useState } from 'react';
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

interface ShuffleProps {
  handleStep: (type: 'next' | 'prev') => void;
  cnt: number;
}

const CardContainer = ({ children }: { children: ReactNode }) => <div className="">{children}</div>;

export default function Shuffle({ handleStep, cnt }: ShuffleProps) {
  const [shuffle, setShuffle] = useState(false); // 셔플 상태를 관리하기 위한 상태 추가
  const handleShuffle = () => {
    setShuffle(true); // 셔플 버튼 클릭 시 셔플 상태를 true로 설정

    setTimeout(() => {
      setShuffle(false); // 2초 뒤에 셔플 상태를 false로 설정하여 애니메이션이 다시 실행되도록 함
    }, 2000);
  };

  const divs = useDeck({
    cnt,
    Group: CardContainer,
    getCard: (i: number) => {
      return (
        <Lottery
          style={
            {
              zIndex: getRandomInteger(0, 100),
              transitionDelay: `${i / cnt}s`,
              '--x': getRandomInteger(-130, 130),
              '--y': getRandomInteger(-120, 30),
            } as React.CSSProperties
          }
          className={clsx(animation['base'], !shuffle ? animation['spread'] : animation['stack'])}
          key={i}
        >
          {getDoubleDigitFormat(i)}
        </Lottery>
      );
    },
  });

  // useEffect(() => {
  //   handleShuffle();
  // }, []);

  return (
    <>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          각자의 번호를 골라주세요~
        </UniqueText>
      </BubbleContainer>

      <div className="flex flex-col justify-center align-center mb-16 mt-6 min-h-[20rem] relative">{divs} </div>
      <div className="flex gap-2">
        <MainButton
          disabled={shuffle}
          label="순서 섞기"
          variant="outlined"
          color="chocolate"
          onClick={() => handleShuffle()}
        />
        <MainButton label="결과 확인" variant="contained" color="chocolate" onClick={() => handleStep('next')} />
      </div>
    </>
  );
}
