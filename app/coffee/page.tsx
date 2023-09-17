'use client';

import React, { useReducer } from 'react';
import Loading from '@/domains/coffee/Loading';
import Order from '@/domains/coffee/Order';
import Shuffle from '@/domains/coffee/Shuffle';
import Start from '@/domains/coffee/Start';

import useStep from '@/lib/hooks/useStep';
import { coffeeReducer, CoffeeActionType, soundReducer, SoundActionType } from '@/lib/reducer/coffee';
import { CoffeeContext, initialCoffeeState, initialallMuteState } from '@/lib/context/coffee';

import Image from 'next/image';

import prevBtnIcon from '@/public/button/button_prev.svg';
import PlayerButton from '@/domains/coffee/PlayerButton';

export default function Coffee() {
  const [step, Container, handleStep] = useStep(0);
  const [orderState, orderDispatch] = useReducer(coffeeReducer, initialCoffeeState);
  const [allMuteState, soundDispatch] = useReducer(soundReducer, initialallMuteState);

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
