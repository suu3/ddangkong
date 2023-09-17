'use client';

import Image from 'next/image';
import playIcon from '@/public/button/button_play.svg';
import muteIcon from '@/public/button/button_mute.svg';

interface PlayerButtonProps {
  onSoundToggle: () => void;
  muted: boolean;
}

const PlayerButton = ({ onSoundToggle, muted }: PlayerButtonProps) => {
  return (
    <div className="fixed top-16 right-2 z-[var(--nav-z-index)] ">
      <Image
        className="cursor-pointer"
        src={muted ? muteIcon : playIcon}
        alt="sound"
        width={45}
        height={45}
        onClick={onSoundToggle}
      />
    </div>
  );
};

export default PlayerButton;
