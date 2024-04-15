'use client';

import React, { useEffect, useReducer } from 'react';
import Image from 'next/image';
import Loading from '@/domains/coffee/Loading';
import Order from '@/domains/coffee/Order';
import Shuffle from '@/domains/coffee/Shuffle';
import Start from '@/domains/coffee/Start';

import PlayerButton from '@/domains/coffee/PlayerButton';
import AudioPlayer from '@/components/AudioPlayer';
import useStep from '@/lib/hooks/useStep';
import usePlayAudio from '@/lib/hooks/usePlayAudio';
import { coffeeReducer, CoffeeActionType, soundReducer, SoundActionType } from '@/lib/reducer/coffee';
import { CoffeeContext, initialCoffeeState, initialallMuteState } from '@/lib/context/coffee';
import prevBtnIcon from '@/public/button/button_prev.svg';
import { BGM_URL } from '@/lib/constants/coffee';

export default function Coffee() {
  const [step, Container, handleStep] = useStep(0);
  const [orderState, orderDispatch] = useReducer(coffeeReducer, initialCoffeeState);
  const [allMuteState, soundDispatch] = useReducer(soundReducer, initialallMuteState);
  const { playerRef, playSound, pauseSound } = usePlayAudio();

  const isMainStep = step === 0;

  const handleOrder = (type: CoffeeActionType) => {
    orderDispatch({ type });
  };

  const onSoundToggle = () => {
    const type = allMuteState.isAllMuted ? 'UNMUTE_SOUND' : 'MUTE_SOUND';
    handleAllMute(type);
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
        {!isMainStep && <AudioPlayer volume={0.4} ref={playerRef} src={BGM_URL} muted={allMuteState.isAllMuted} />}
        {!isMainStep && <PlayerButton onSoundToggle={onSoundToggle} muted={allMuteState.isAllMuted} />}
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
