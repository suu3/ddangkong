'use client';

import { useState } from 'react';
import Image from 'next/image';
import Loading from '@/domains/coffee/Loading';
import Order from '@/domains/coffee/Order';
import Shuffle from '@/domains/coffee/Shuffle';
import Start from '@/domains/coffee/Start';
import useStep from '@/lib/hooks/useStep';

import prevBtnIcon from '@/public/button/button_prev.svg';

export default function Coffee() {
  const [step, Container, handleStep] = useStep(0);
  return (
    <div className="relative ">
      {step !== 0 && (
        <Image
          className="fixed z-[var(--nav-z-index)] top-2 left-2 cursor-pointer"
          src={prevBtnIcon}
          alt="이전 버튼"
          width={32}
          height={32}
          onClick={() => handleStep('prev')}
        />
      )}
      <Container curStep={step}>
        <Start handleStep={handleStep} />
        <Order handleStep={handleStep} />
        <Shuffle handleStep={handleStep} />
        <Loading />
      </Container>
    </div>
  );
}
