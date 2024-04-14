'use client';

import React, { useEffect, useReducer } from 'react';
import Image from 'next/image';

import useStep from '@/lib/hooks/useStep';
import prevBtnIcon from '@/public/button/button_prev.svg';
import Start from '@/domains/roulette/Start';
import Order from '@/domains/roulette/Order';

export default function Coffee() {
  const [step, Container, handleStep] = useStep(0);

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
      <Container curStep={step}>
        <Start handleStep={handleStep} />
        <Order handleStep={handleStep} />
        {/* 
          <Shuffle cnt={orderState.total} handleStep={handleStep} />
          <Loading /> */}
      </Container>
    </div>
  );
}
