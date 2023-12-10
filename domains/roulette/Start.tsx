import React, { useState, useEffect, useContext } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import MainButton from '@/components/button/MainButton';
import Tooltip from '@/components/Tooltip';
import UniqueText from '@/components/UniqueText';

import mainImage from '@/public/roulette/main.svg';
import pinImage from '@/public/roulette/pin.svg';
import animation from './animation.module.css';

interface StartProps {
  handleStep: (type: 'next' | 'prev') => void;
}

export default function Start({ handleStep }: StartProps) {
  const [randomNum, setRandomNum] = useState(0);

  return (
    <>
      <UniqueText Tag="h1" font="sans" size="lg" className="text-center pt-8">
        운명의
        <br />
        <span className="text-[3.625rem] leading-[103.8%]">돌림판</span>
      </UniqueText>
      <div className="mt-[2.6rem] relative w-[262px] h-[262px] mx-auto">
        <Image
          src={pinImage}
          className="absolute -top-[0.73rem] left-1/2 -translate-x-1/2 z-10"
          width={20.3}
          height={35.6}
          alt="고정 핀"
        />

        <Image
          src={mainImage}
          className={clsx(animation['rotate'], 'absolute top-0')}
          width={262}
          height={262}
          alt="돌림판"
        />
      </div>
      <div className="relative">
        <div className="absolute -translate-x-1/2 -translate-y-2 top-[calc(-100%)] left-1/2">
          <Tooltip className="animate-bounce" visible>
            Click !
          </Tooltip>
        </div>
        <MainButton className="mt-20 mb-10" onClick={() => handleStep('next')} variant="contained" color="chocolate">
          시작하기
        </MainButton>
      </div>
    </>
  );
}
const ROTATION_DURATION = 1500;
