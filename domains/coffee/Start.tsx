import React, { useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import MainButton from '@/components/button/MainButton';
import Tooltip from '@/components/Tooltip';
import UniqueText from '@/components/UniqueText';
import mainImage from '@/public/coffee/main.svg';
import skullImage from '@/public/coffee/skull.svg';
import animation from './animation.module.css';
import { useEffect } from 'react';
import { getRandomInteger } from '@/lib/utils/random';

interface StartProps {
  handleStep: (type: 'next' | 'prev') => void;
}

export default function Start({ handleStep }: StartProps) {
  const [randomNum, setRandomNum] = useState(0);
  const FADE_IN_DURATION = 1500;

  const skullImgMetaList = [
    {
      location: 'top-[3.5rem] right-[7rem]',
      rotate: 'rotate-[62deg]',
    },
    {
      location: 'top-[12rem] right-[3rem]',
      rotate: '-rotate-[150deg]',
    },
    {
      location: 'top-[12.5rem] left-[4.2rem]',
      rotate: '-rotate-[70deg]',
    },
    {
      location: 'top-[6.5rem] right-[1.6rem]',
      rotate: 'rotate-[155deg]',
    },
    {
      location: 'top-[7.6rem] left-[2rem]',
      rotate: '-rotate-2',
    },
  ];

  const renderSkullImg = skullImgMetaList.map(({ location = '', rotate = '' }, index: number) => (
    <Image
      key={index}
      src={skullImage}
      className={clsx('absolute', location, rotate, animation['skull'], randomNum === index && animation[`fade-in`])}
      width={127}
      height={126}
      alt="해골"
    />
  ));

  useEffect(() => {
    const timer = setInterval(() => {
      setRandomNum(prev => {
        let selected = getRandomInteger(0, 4);
        while (prev === selected) {
          selected = getRandomInteger(0, 4);
        }
        return selected;
      });
    }, FADE_IN_DURATION);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <UniqueText Tag="h1" font="sans" size="lg" className="text-center pt-8">
        커피내기
        <br />
        <strong className="text-4xl font-normal">복불복</strong>
      </UniqueText>
      <div className="pt-8 relative w-[335px] h-[321px]">
        {renderSkullImg}
        <Image src={mainImage} priority width={335} height={321} alt="다섯 명이 빈 종이를 내밀고 있음" />
      </div>
      <div className="relative">
        <div className="absolute -translate-x-1/2 -translate-y-2 top-[calc(-100%)] left-1/2">
          <Tooltip className="animate-bounce" visible>
            Click !
          </Tooltip>
        </div>
        <MainButton
          className="mt-20 mb-10"
          label="시작하기"
          onClick={() => handleStep('next')}
          variant="contained"
          color="chocolate"
        />
      </div>
    </>
  );
}
