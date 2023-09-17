'use client';

import React, { useEffect, useReducer } from 'react';
import Image from 'next/image';
import Loading from '@/domains/coffee/Loading';
import Order from '@/domains/coffee/Order';
import Shuffle from '@/domains/coffee/Shuffle';
import Start from '@/domains/coffee/Start';

import useStep from '@/lib/hooks/useStep';
import { coffeeReducer, CoffeeActionType, soundReducer, SoundActionType } from '@/lib/reducer/coffee';
import { CoffeeContext, initialCoffeeState, initialallMuteState } from '@/lib/context/coffee';

import usePlayAudio from '@/lib/hooks/usePlayAudio';

import prevBtnIcon from '@/public/button/button_prev.svg';
import PlayerButton from '@/domains/coffee/PlayerButton';
import AudioPlayer from '@/components/AudioPlayer';

export default function Coffee() {
  const [step, Container, handleStep] = useStep(0);
  const [orderState, orderDispatch] = useReducer(coffeeReducer, initialCoffeeState);
  const [allMuteState, soundDispatch] = useReducer(soundReducer, initialallMuteState);
  const { playerRef, playSound, pauseSound } = usePlayAudio();

  const handleOrder = (type: CoffeeActionType) => {
    orderDispatch({ type });
  };

  const handleAllMute = (type: SoundActionType) => {
    soundDispatch({ type });
  };

  const renderPrevBtn = step !== 0 && (
    <Image
      className="fixed z-[var(--nav-z-index)] top-16 left-2 cursor-pointer"
      src={prevBtnIcon}
      alt="이전 버튼"
      width={32}
      height={32}
      onClick={() => handleStep('prev')}
    />
  );

  useEffect(() => {
    playSound(playerRef?.current?.audio?.current);
  }, [allMuteState.isAllMuted, playSound, playerRef]);

  // useEffect(() => {
  //   const button = document.createElement('button');
  //   document.body.appendChild(button);
  //   button.addEventListener('click', () => {
  //     button.remove();
  //   }
  // }, []);

  return (
    <div className="relative">
      {renderPrevBtn}
      <CoffeeContext.Provider
        value={{
          orderState,
          allMuteState,
          handleOrder,
          handleAllMute,
        }}
      >
        <AudioPlayer volume="0.3" ref={playerRef} src="/sound/bgm.mp3" muted={allMuteState.isAllMuted} />
        <PlayerButton />
        <Container curStep={step}>
          <Start handleStep={handleStep} />
          <Order state={orderState} handleStep={handleStep} />
          <Shuffle cnt={orderState.total} handleStep={handleStep} />
          <Loading />
        </Container>
      </CoffeeContext.Provider>
    </div>
  );
}
