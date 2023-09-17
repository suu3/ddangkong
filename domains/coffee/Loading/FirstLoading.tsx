import Image from 'next/image';
import loadingImage from '@/public/coffee/loading.gif';
import UniqueText from '@/components/UniqueText';
import AudioPlayer from '@/components/AudioPlayer';
import usePlayAudio from '@/lib/hooks/usePlayAudio';
import { CoffeeContext } from '@/lib/context/coffee';
import { useContext, useEffect } from 'react';

const FirstLoading = () => {
  const {
    allMuteState: { isAllMuted },
  } = useContext(CoffeeContext);
  const { playerRef, playSound } = usePlayAudio();

  useEffect(() => {
    playSound(playerRef?.current?.audio?.current);
  }, [isAllMuted, playSound, playerRef]);

  return (
    <article className="flex flex-col min-h-[36rem] items-center justify-center">
      <AudioPlayer muted={isAllMuted} src="/sound/water.mp3" ref={playerRef} />
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
      <div className="relative h-44	w-24">
        <Image loading="eager" className="animate-pulse" src={loadingImage} fill sizes="100%" alt="" />
      </div>
    </article>
  );
};

export default FirstLoading;
