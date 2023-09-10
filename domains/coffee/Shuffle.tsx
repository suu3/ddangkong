import BubbleContainer from '@/components/BubbleContainer';
import MainButton from '@/components/button/MainButton';
import Lottery from '@/components/Lottery';
import UniqueText from '@/components/UniqueText';
import { getDoubleDigitFormat } from '@/lib/utils/format';

interface ShuffleProps {
  handleStep: (type: 'next' | 'prev') => void;
  cnt: number;
}

export default function Shuffle({ handleStep, cnt }: ShuffleProps) {
  const divs = [];
  let currentDivs = [];

  const isNumberDivisibleBy = (n: number, divisor: number) => {
    return n % divisor === 0;
  };

  const divisor = 3; //isNumberDivisibleBy(cnt, 2) ? 2 : 3;

  for (let i = 1; i <= cnt; i++) {
    currentDivs.push(<Lottery key={i} cnt={getDoubleDigitFormat(i)} />);

    if (i % divisor === 0 || i === cnt) {
      divs.push(
        <div key={divs.length} className="w-full flex items-center justify-evenly">
          {currentDivs}
        </div>
      );
      currentDivs = [];
    }
  }

  return (
    <>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          각자의 번호를 골라주세요~
        </UniqueText>
      </BubbleContainer>

      <div className="flex flex-col justify-center align-center mb-16 mt-6 min-h-[20rem]">{divs}</div>
      <div className="flex gap-2">
        <MainButton label="순서 섞기" variant="outlined" color="chocolate" />
        <MainButton label="결과 확인" variant="contained" color="chocolate" onClick={() => handleStep('next')} />
      </div>
    </>
  );
}
