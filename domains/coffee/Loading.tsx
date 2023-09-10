import UniqueText from '@/components/UniqueText';
import loadingImage from '@/public/coffee/loading.gif';
import Image from 'next/image';

const Loading = () => {
  return (
    <div className="bg-white fixed flex flex-col items-center justify-center top-0 left-0 right-0 bottom-0">
      <div className="flex">
        <UniqueText font="sans" Tag="div" size="ml" className="mb-7">
          커피 만드는 중
        </UniqueText>
        <UniqueText font="sans" Tag="span" size="ml" className="animate-[pulse_2s_infinite_]">
          .
        </UniqueText>
        <UniqueText font="sans" Tag="span" size="ml" className="animate-[pulse_2s_infinite_400ms]">
          .
        </UniqueText>
        <UniqueText font="sans" Tag="span" size="ml" className="animate-[pulse_2s_infinite_800ms]">
          .
        </UniqueText>
      </div>
      <div className="relative h-44	w-24 ">
        <Image className="animate-pulse" src={loadingImage} fill alt="로딩 이미지" />
      </div>
    </div>
  );
};

export default Loading;
