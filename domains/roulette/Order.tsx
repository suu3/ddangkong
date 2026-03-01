import { ChangeEvent, Fragment, useContext, useEffect, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

import MainButton from '@/components/button/MainButton';
import UniqueText from '@/components/UniqueText';
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

export default function Order({ handleStep }: OrderProps) {
  const { orderState, handleOrder } = useContext(RouletteContext);
  const items = orderState.total;
  const [input, setInput] = useState('');

  const handleChangeText = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = () => {
    const value = input.trim();
    if (items.length >= MAX_DIVIDER || value === '') return;

    handleOrder({
      type: 'ADD_ITEM',
      payload: [...items, value],
    });
    setInput('');
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  useEffect(() => {
    const canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (items.length === 0) {
      return;
    }

    if (items.length === 1) {
      drawTextCenter(ctx, rect.width, rect.height, items[0]);
      return;
    }

    drawItems(ctx, rect.width, rect.height, items);
  }, [items]);

  function drawItems(ctx: CanvasRenderingContext2D, width: number, height: number, list: string[]) {
    const totalDegrees = 360;
    let startAngle = 0;
    const itemCount = list.length;
    const angleIncrement = totalDegrees / itemCount;

    for (let i = 0; i < itemCount; i++) {
      const endAngle = startAngle + angleIncrement;
      drawLine(ctx, width, height, startAngle, endAngle);
      drawText(ctx, width, height, list[i], startAngle, endAngle);
      startAngle = endAngle;
    }
  }

  function drawLine(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    startAngle: number,
    endAngle: number
  ) {
    const x = width / 2;
    const y = height / 2;
    const radius = width / 2;
    const startRadians = ((startAngle - 90) * Math.PI) / 180;
    const endRadians = ((endAngle - 90) * Math.PI) / 180;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + radius * Math.cos(startRadians), y + radius * Math.sin(startRadians));
    ctx.moveTo(x, y);
    ctx.lineTo(x + radius * Math.cos(endRadians), y + radius * Math.sin(endRadians));
    ctx.stroke();
  }

  function drawTextCenter(ctx: CanvasRenderingContext2D, width: number, height: number, text: string) {
    const x = width / 2;
    const y = height / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.textAlign = 'center';
    ctx.font = '700 20px UhBeeTokki';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawText(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    text: string,
    startAngle: number,
    endAngle: number
  ) {
    const x = width / 2;
    const y = height / 2;
    const radius = width / 4;
    const angle = (endAngle + startAngle) / 2 - 90;
    const radians = (angle * Math.PI) / 180;

    ctx.save();
    ctx.translate(x + radius * Math.cos(radians), y + radius * Math.sin(radians));
    ctx.rotate(radians + Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '700 20px UhBeeTokki';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  return (
    <Fragment>
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
            어떤걸 돌려볼까?
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
          placeholder="내용을 입력해 주세요"
          value={input}
        />
        <StyledButton
          onClick={handleSubmit}
          disabled={items.length >= MAX_DIVIDER || input.trim() === ''}
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
        }}
        className="mb-10 "
      >
        돌리기
      </MainButton>
    </Fragment>
  );
}
