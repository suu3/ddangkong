import { BGM_URL } from '@/lib/constants/coffee';
import { forwardRef } from 'react';
import H5AudioPlayer from 'react-h5-audio-player';

interface AudioPlayerProps {
  src?: string;
  muted?: boolean;
  volume?: number;
  autoPlay?: boolean;
}

const AudioPlayer = forwardRef<H5AudioPlayer, AudioPlayerProps>(
  ({ src = BGM_URL, muted = false, volume = 1, autoPlay = false }, ref) => {
    return (
      <H5AudioPlayer
        src={src}
        preload="auto"
        className="hidden"
        autoPlay={autoPlay}
        muted={muted}
        volume={volume}
        ref={ref}
      />
    );
  }
);

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
