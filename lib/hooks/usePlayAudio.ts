import { RefObject, useState, useRef, useEffect } from 'react';
import AudioPlayer from 'react-h5-audio-player';

const usePlayAudio = () //isAllMuted: boolean
: {
  playerRef: RefObject<AudioPlayer>;
  //onToggle: () => void;
  //isPaused: boolean;
  playSound: (audio: HTMLAudioElement | null | undefined) => void;
  pauseSound: (audio: HTMLAudioElement | null | undefined) => void;
} => {
  const playerRef = useRef<AudioPlayer>(null);
  // const [isPaused, setIsPaused] = useState(true);

  const playSound = (audio: HTMLAudioElement | null | undefined) => {
    if (audio) audio.play();
  };

  const pauseSound = (audio: HTMLAudioElement | null | undefined) => {
    if (audio) audio.pause();
  };

  // const onToggle = () => {
  //   if (!playerRef.current) return;

  //   setIsPaused(prev => !prev);
  // };

  // useEffect(() => {
  //   if (isPaused) {
  //     pauseSound();
  //   } else {
  //     playSound();
  //   }
  // }, [isPaused]);

  return { playerRef, playSound, pauseSound };
};

export default usePlayAudio;
