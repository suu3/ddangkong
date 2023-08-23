import BubbleContainer from "@/components/BubbleContainer";
import MainButton from "@/components/button/MainButton";
import UpDownButton from "@/components/button/UpDownButton";
import UniqueText from "@/components/UniqueText";
import useUpDownCnt from "@/lib/hooks/useUpDownCnt";
import baristarImage from "@/public/coffee/baristar.svg";
import Image from "next/image";

export default function Order() {
  const [totalCnt, handleTotalIncrease, handleTotalDecrease] = useUpDownCnt(0);
  const [blankCnt, handleBlankIncrease, handleBlankDecrease] = useUpDownCnt(0);

  return (
    <>
      <BubbleContainer width={234} height={62} className="mt-10 mx-auto ">
        <UniqueText Tag="span" size="md" font="uhbee" className="absolute">
          커피를 마실 사람은 몇 명인가요?
        </UniqueText>
      </BubbleContainer>
      <Image
        src={baristarImage}
        alt="수염이 매력적인 따뜻한 아메리카노 바리스타"
        width={270}
        height={330}
        className="mb-8"
      />
      <div className="mb-16">
        <div className="flex items-center justify-center">
          <UniqueText
            Tag="span"
            size="md"
            font="sans"
            className="mr-4"
            style={{ width: "4.35rem" }}
          >
            총 인원 :
          </UniqueText>
          <UpDownButton
            handleIncrease={handleTotalIncrease}
            handleDecrease={handleTotalDecrease}
            count={totalCnt}
          />
        </div>

        <div className="flex items-center justify-center pt-4">
          <UniqueText
            Tag="span"
            size="md"
            font="sans"
            className="mr-4 text-right"
            style={{ width: "4.35rem" }}
          >
            꽝 :
          </UniqueText>
          <UpDownButton
            handleIncrease={handleBlankIncrease}
            handleDecrease={handleBlankDecrease}
            count={blankCnt}
          />
        </div>
      </div>
      <MainButton label="주문하기" variant="contained" color="chocolate" />
    </>
  );
}
