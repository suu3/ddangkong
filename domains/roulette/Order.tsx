import { ChangeEvent, Fragment, SetStateAction, useContext, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

import MainButton from '@/components/button/MainButton';
import UniqueText from '@/components/UniqueText';
// import AudioPlayer from '@/components/AudioPlayer';
import usePlayAudio from '@/lib/hooks/usePlayAudio';

import mainImage from '@/public/roulette/empty-roulette.svg';
import pinImage from '@/public/roulette/pin.svg';
import { MainInput } from '@/components/input';
import StyledButton from '@/components/button/StyledButton';
import { RouletteContext } from '@/lib/context/roulette';

interface OrderProps {
  handleStep: (type: 'next' | 'prev') => void;
  state?: {
    boom: number;
    total: number;
  };
}

const MAX_DIVIDER = 10;

export default function Order({ handleStep, state }: OrderProps) {
  const { orderState, handleOrder } = useContext(RouletteContext);
  // const { angle, total } = orderState;
  const { playerRef, playSound, pauseSound } = usePlayAudio();
  const [input, setInput] = useState('');
  const itemsRef = useRef([]);
  const items = itemsRef?.current;

  const handleChangeText = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = () => {
    if (items.length >= MAX_DIVIDER || input === '') return;

    addItem(input);
    setInput('');
  };

  const handleKeyPress = event => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };
  const componseSoundAndClick = (callback: () => void) => {
    playSound(playerRef?.current?.audio?.current);
    callback();
  };

  function adjustCanvasResolution() {
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');

    // 디바이스의 픽셀 비율을 구함
    const dpr = window.devicePixelRatio || 1;
    // 원래 `canvas`의 크기를 저장
    const rect = canvas.getBoundingClientRect();

    // `canvas`의 크기를 디바이스의 픽셀 비율에 맞게 조정
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // CSS를 통해 `canvas`의 디스플레이 크기를 원래대로 조정
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // `canvas`의 스케일을 조정하여 모든 드로잉이 디바이스 픽셀 비율을 반영하도록 함
    ctx.scale(dpr, dpr);
  }

  useEffect(() => {
    window.onload = function () {
      drawImageOnCanvas();
    };
  }, []);

  const img = document?.getElementById('wheelImage');
  const canvas = document?.getElementById('wheelCanvas');
  const ctx = canvas?.getContext('2d');

  function drawImageOnCanvas() {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    adjustCanvasResolution();
  }

  function addItem(input) {
    const items = itemsRef.current;
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas?.getContext('2d');

    itemsRef.current = [...items, input];
    // handleOrder({
    //   type: 'ADD_ITEM',
    //   payload: input,
    // });
    clearCanvas(ctx, canvas);
    if (items.length === 0) {
      drawTextCenter(input);
      return;
    }
    drawItems(); // 선과 텍스트를 포함하여 항목을 그립니다.
  }

  function clearCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawItems() {
    const items = itemsRef.current;
    const totalDegrees = 360;
    let startAngle = 0;
    const itemCount = items.length;
    const angleIncrement = totalDegrees / itemCount;

    for (let i = 0; i < itemCount; i++) {
      const endAngle = startAngle + angleIncrement;
      drawLine(startAngle, endAngle);
      drawText(items[i], startAngle, endAngle);
      startAngle = endAngle;
    }

    function drawLine(startAngle, endAngle) {
      const x = canvas.width / 2;
      const y = canvas.height / 2;
      const radius = canvas.width / 2;
      const startRadians = ((startAngle - 90) * Math.PI) / 180;
      const endRadians = ((endAngle - 90) * Math.PI) / 180;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + radius * Math.cos(startRadians), y + radius * Math.sin(startRadians));
      ctx.moveTo(x, y);
      ctx.lineTo(x + radius * Math.cos(endRadians), y + radius * Math.sin(endRadians));
      ctx.stroke();
    }
  }

  function drawTextCenter(text) {
    const x = canvas.width / 2;
    const y = canvas.height / 2;

    ctx.save(); // 현재 상태 저장
    ctx.translate(x, y);
    ctx.textAlign = 'center';
    ctx.font = '700 20px UhBeeTokki';

    ctx.fillText(text, 0, 0);
    ctx.restore(); // 저장된 상태로 복원
  }

  function drawText(text, startAngle, endAngle) {
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    const radius = canvas.width / 4; // 텍스트 위치를 위한 반지름 조정
    const angle = (endAngle + startAngle) / 2 - 90; // 부채꼴의 중앙 각도
    const radians = (angle * Math.PI) / 180;

    ctx.save(); // 현재 상태 저장
    ctx.translate(x + radius * Math.cos(radians), y + radius * Math.sin(radians));
    ctx.rotate(radians + Math.PI / 2); // 텍스트가 항상 올바른 방향으로 표시되도록 회전
    ctx.textAlign = 'center';
    ctx.font = '700 20px UhBeeTokki';

    ctx.fillText(text, 0, 0);
    ctx.restore(); // 저장된 상태로 복원
  }
  return (
    <Fragment>
      {/* <AudioPlayer muted={allMuteState.isAllMuted} src="/sound/click.mp3" ref={playerRef} /> */}
      <div className="mt-[74px] relative w-[262px] h-[262px] mx-auto">
        <Image
          src={pinImage}
          className="absolute -top-[0.73rem] left-1/2 -translate-x-1/2 z-10"
          width={20.3}
          height={35.6}
          alt="고정 핀"
        />
        {items.length === 0 && (
          <UniqueText
            Tag="span"
            size="md"
            font="uhbee"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          >
            어떤걸 돌려볼까요?
          </UniqueText>
        )}

        <Image
          src={mainImage}
          id="wheelImage"
          className={clsx('absolute top-0')}
          width={262}
          height={262}
          alt="돌림판"
        />
        <canvas
          id="wheelCanvas"
          width="232"
          height="232"
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}
        ></canvas>
      </div>
      <div className="mt-[16px] mb-[2.5rem] flex justify-center items-center gap-[8px]">
        <MainInput
          onKeyPress={handleKeyPress}
          onChange={handleChangeText}
          placeholder="내용을 입력해 주세요."
          value={input}
        />
        <StyledButton
          onClick={handleSubmit}
          disabled={items.length >= MAX_DIVIDER || input === ''}
          className="w-[40px] h-[40px] shrink-0"
          variant="icon"
          color="chocolate"
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 8V24" stroke="#FFFBFA" strokeWidth="2" strokeLinecap="round" />
            <path d="M24 16L8 16" stroke="#FFFBFA" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </StyledButton>
      </div>
      <MainButton
        disabled={items.length === 0}
        variant="contained"
        color="chocolate"
        onClick={() => {
          handleStep('next');
          handleOrder({
            type: 'ADD_ITEM',
            payload: itemsRef.current,
          });
        }}
        className="mb-10 "
      >
        돌리기
      </MainButton>
    </Fragment>
  );
}
