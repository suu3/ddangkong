import BubbleContainer from '@/components/BubbleContainer';
import MainButton from '@/components/button/MainButton';
import UpDownButton from '@/components/button/UpDownButton';
import UniqueText from '@/components/UniqueText';
import { CoffeeActionType } from '@/lib/reducer/coffeeReducer';
import baristarImage from '@/public/coffee/baristar.svg';
import steam1 from '@/public/coffee/steam-1.svg';
import steam2 from '@/public/coffee/steam-2.svg';
import clsx from 'clsx';
import Image from 'next/image';
import animation from './animation.module.css';

interface OrderProps {
  handleStep: (type: 'next' | 'prev') => void;
  state: {
    boom: number;
    total: number;
  };
  handleOrder: (type: CoffeeActionType) => void;
}

export default function Order({ handleStep, state, handleOrder }: OrderProps) {
  const { boom, total } = state;

  return (
    <>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          커피를 마실 사람은 몇 명인가요?
        </UniqueText>
      </BubbleContainer>
      <div className="relative mb-8">
        <Image src={steam1} alt="연기" width={270} height={330} className={clsx('absolute')} />
        <Image src={steam2} alt="연기" width={270} height={330} className={clsx('absolute')} />
        <Image
          priority
          src={baristarImage}
          alt="수염이 매력적인 따뜻한 아메리카노 바리스타"
          width={270}
          height={330}
          className="mb-8"
        />
      </div>
      <div className="mb-16">
        <div className="flex items-center justify-center">
          <UniqueText Tag="span" size="md" font="sans" className="mr-4 w-[4.35rem]">
            총 인원 :
          </UniqueText>
          <UpDownButton
            handleIncrease={() => handleOrder('increaseTotal')}
            handleDecrease={() => handleOrder('decreaseTotal')}
            count={total}
          />
        </div>

        <div className="flex items-center justify-center pt-4">
          <UniqueText Tag="span" size="md" font="sans" className="mr-4 text-right w-[4.35rem]">
            꽝 :
          </UniqueText>
          <UpDownButton
            handleIncrease={() => {
              handleOrder('increaseBoom');
            }}
            handleDecrease={() => handleOrder('decreaseBoom')}
            count={boom}
          />
        </div>
      </div>
      <MainButton
        disabled={total === 0 || boom === 0}
        label="주문하기"
        variant="contained"
        color="chocolate"
        onClick={() => handleStep('next')}
        className="mb-10"
      />
    </>
  );
}
