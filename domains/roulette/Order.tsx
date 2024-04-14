import { ChangeEvent, Fragment, SetStateAction, useContext, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

import MainButton from '@/components/button/MainButton';
import UniqueText from '@/components/UniqueText';
import AudioPlayer from '@/components/AudioPlayer';
import { CoffeeContext } from '@/lib/context/coffee';
import usePlayAudio from '@/lib/hooks/usePlayAudio';

import mainImage from '@/public/roulette/empty-roulette.svg';
import pinImage from '@/public/roulette/pin.svg';
import animation from './animation.module.css';
import { MainInput } from '@/components/input';
import StyledButton from '@/components/button/StyledButton';

interface OrderProps {
  handleStep: (type: 'next' | 'prev') => void;
  state?: {
    boom: number;
    total: number;
  };
}

export default function Order({ handleStep, state }: OrderProps) {
  const { allMuteState, orderState, handleOrder } = useContext(CoffeeContext);
  const { boom, total } = orderState;
  const { playerRef, playSound, pauseSound } = usePlayAudio();
  const [input, setInput] = useState('');

  const handleChangeText = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };
  const componseSoundAndClick = (callback: () => void) => {
    playSound(playerRef?.current?.audio?.current);
    callback();
  };

  return (
    <Fragment>
      <AudioPlayer muted={allMuteState.isAllMuted} src="/sound/click.mp3" ref={playerRef} />
      <div className="mt-[74px] relative w-[262px] h-[262px] mx-auto">
        <Image
          src={pinImage}
          className="absolute -top-[0.73rem] left-1/2 -translate-x-1/2 z-10"
          width={20.3}
          height={35.6}
          alt="고정 핀"
        />
        <UniqueText
          Tag="span"
          size="md"
          font="uhbee"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        >
          어떤걸 돌려볼까요?
        </UniqueText>
        <Image src={mainImage} className={clsx('absolute top-0')} width={262} height={262} alt="돌림판" />
      </div>
      <div className="mt-[16px] mb-[2.5rem] flex justify-center items-center gap-[8px]">
        <MainInput onChange={handleChangeText} placeholder="내용을 입력해 주세요." value={input} />
        <StyledButton className="w-[40px] h-[40px] shrink-0" variant="icon" color="chocolate">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 8V24" stroke="#FFFBFA" stroke-width="2" stroke-linecap="round" />
            <path d="M24 16L8 16" stroke="#FFFBFA" stroke-width="2" stroke-linecap="round" />
          </svg>
        </StyledButton>
      </div>
      <MainButton
        disabled={total === 0 || boom === 0}
        variant="contained"
        color="chocolate"
        onClick={() => handleStep('next')}
        className="mb-10 "
      >
        돌리기
      </MainButton>
    </Fragment>
  );
}
