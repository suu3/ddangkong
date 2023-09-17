'use client';

import { useContext } from 'react';
import Image from 'next/image';
import { CoffeeContext } from '@/lib/context/coffee';
import playIcon from '@/public/button/button_play.svg';
import muteIcon from '@/public/button/button_mute.svg';

const PlayerButton = () => {
  const context = useContext(CoffeeContext);
  const {
    allMuteState: { isAllMuted },
    handleAllMute,
  } = context;

  const onToggle = () => {
    const type = isAllMuted ? 'UNMUTE_SOUND' : 'MUTE_SOUND';
    handleAllMute(type);
  };

  return (
    <div className="fixed top-16 right-2 z-[var(--nav-z-index)] ">
      <Image
        className="cursor-pointer"
        src={isAllMuted ? muteIcon : playIcon}
        alt="sound"
        width={45}
        height={45}
        onClick={onToggle}
      />
    </div>
  );
};

export default PlayerButton;
