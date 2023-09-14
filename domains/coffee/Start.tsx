import MainButton from '@/components/button/MainButton';
import mainImage from '@/public/coffee/main.svg';
import Image from 'next/image';
import UniqueText from '@/components/UniqueText';

interface StartProps {
  handleStep: (type: 'next' | 'prev') => void;
}

export default function Start({ handleStep }: StartProps) {
  return (
    <>
      <UniqueText Tag="h1" font="sans" size="lg" className="text-center pt-8">
        커피내기
        <br />
        <strong className="text-4xl font-normal">복불복</strong>
      </UniqueText>
      <Image
        priority
        className="pt-8"
        src={mainImage}
        width={335}
        height={321}
        alt="다섯 명이 종이를 내밀고 있고 두 명이 해골이 그려진 종이를 들고 있음"
      />
      <MainButton
        className="mt-10"
        label="시작하기"
        onClick={() => handleStep('next')}
        variant="contained"
        color="chocolate"
      />
    </>
  );
}
