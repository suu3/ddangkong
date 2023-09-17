import { forwardRef, useEffect, useState } from 'react';
import H5AudioPlayer from 'react-h5-audio-player';

interface AudioPlayerProps {
  src?: string;
  muted?: boolean;
  volume?: number;
}

const AudioPlayer = forwardRef<H5AudioPlayer, AudioPlayerProps>(
  ({ src = '/sound/bgm.mp3', muted = false, volume = 1 }, ref) => {
    if (muted) return null;
    return <H5AudioPlayer src={src} preload="auto" className="hidden" autoPlay={false} volume={volume} ref={ref} />;
  }
);

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
