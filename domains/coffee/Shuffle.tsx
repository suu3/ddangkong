import BubbleContainer from '@/components/BubbleContainer';
import MainButton from '@/components/button/MainButton';
import Lottery from '@/components/Lottery';
import UniqueText from '@/components/UniqueText';
import { getDoubleDigitFormat } from '@/lib/utils/format';

export default function Shuffle() {
  const cnt = 9;
  return (
    <>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          각자의 번호를 골라주세요~
        </UniqueText>
      </BubbleContainer>

      <div className="mb-16 grid gap-3 grid-cols-3 grid-rows-t mt-6">
        {Array.from({ length: cnt }).map((_, idx) => {
          return <Lottery key={idx} cnt={getDoubleDigitFormat(idx + 1)} />;
        })}
      </div>
      <div className="flex gap-2">
        <MainButton label="순서 섞기" variant="outlined" color="chocolate" />
        <MainButton label="결과 확인" variant="contained" color="chocolate" />
      </div>
    </>
  );
}
