'use client';

import React, { useEffect, useReducer } from 'react';
import Image from 'next/image';

import useStep from '@/lib/hooks/useStep';
import prevBtnIcon from '@/public/button/button_prev.svg';
import Start from '@/domains/roulette/Start';
import Order from '@/domains/roulette/Order';
import { RouletteAction, rouletteReducer } from '@/lib/reducer/roulette';
import { RouletteContext, initialRouletteState } from '@/lib/context/roulette';
import Loading from '@/domains/roulette/Loading';

export default function Coffee() {
  const [step, Container, handleStep] = useStep(0);
  const [orderState, orderDispatch] = useReducer(rouletteReducer, initialRouletteState);

  const handleOrder = ({ type, payload }: RouletteAction) => {
    orderDispatch({ type, payload });
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
      <RouletteContext.Provider
        value={{
          orderState,
          // allMuteState,
          handleOrder,
          // handleAllMute,
        }}
      >
        <Container curStep={step}>
          <Start handleStep={handleStep} />
          <Order handleStep={handleStep} />
          <Loading handleStep={handleStep} />
          {/* 
          
          <Loading /> */}
        </Container>
      </RouletteContext.Provider>
    </div>
  );
}
