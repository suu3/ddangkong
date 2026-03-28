'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Dispatch,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BGM_URL } from '@/lib/constants/coffee';
import {
  COFFEE_HOME,
  COFFEE_RESULT,
  HOT_POTATO_HOME,
  ROULETTE_HOME,
  TEAM_SPLIT_HOME,
} from '@/lib/constants/serviceUrls';
import muteIcon from '@/public/button/button_mute.svg';
import playIcon from '@/public/button/button_play.svg';

type GlobalSoundTrack = {
  src: string;
  volume?: number;
};

interface SoundContextValue {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  track: GlobalSoundTrack | null;
  setTrack: Dispatch<SetStateAction<GlobalSoundTrack | null>>;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setMutedState] = useState(false);
  const [track, setTrack] = useState<GlobalSoundTrack | null>(null);
  const pathname = usePathname();
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);

  const routeTrack = useMemo<GlobalSoundTrack | null>(() => {
    if (pathname === COFFEE_RESULT) {
      return { src: '/sound/bgm-result.mp3', volume: 0.28 };
    }

    if ([COFFEE_HOME, ROULETTE_HOME, HOT_POTATO_HOME, TEAM_SPLIT_HOME].includes(pathname)) {
      return { src: BGM_URL, volume: 0.28 };
    }

    return null;
  }, [pathname]);

  const activeTrack = track ?? routeTrack;

  const toggleMute = useCallback(() => {
    setMutedState(prev => !prev);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    setMutedState(muted);
  }, []);

  useEffect(() => {
    const audio = bgmAudioRef.current ?? new window.Audio();
    bgmAudioRef.current = audio;
    audio.preload = 'auto';
    audio.loop = true;

    if (!activeTrack || isMuted) {
      audio.pause();
      return;
    }

    if (audio.src !== new URL(activeTrack.src, window.location.origin).href) {
      audio.pause();
      audio.src = activeTrack.src;
      audio.load();
    }

    audio.volume = activeTrack.volume ?? 1;
    void audio.play().catch(() => undefined);
  }, [activeTrack, isMuted]);

  useEffect(() => {
    return () => {
      const audio = bgmAudioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = '';
      bgmAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = new window.Audio('/sound/click.mp3');
    audio.preload = 'auto';
    audio.volume = 0.7;
    clickAudioRef.current = audio;

    return () => {
      audio.pause();
      clickAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (isMuted) return;

      const target = event.target as HTMLElement | null;
      const interactive = target?.closest('button, [role="button"], a[href]');
      if (!interactive) return;

      if (interactive instanceof HTMLButtonElement && interactive.disabled) return;
      if (interactive.getAttribute('aria-disabled') === 'true') return;

      const audio = clickAudioRef.current;
      if (!audio) return;

      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [isMuted]);

  const value = useMemo(
    () => ({
      isMuted,
      toggleMute,
      setMuted,
      track,
      setTrack,
    }),
    [isMuted, setMuted, toggleMute, track]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within SoundProvider');
  }

  return context;
}

export function GlobalSoundButton() {
  const { isMuted, toggleMute } = useSound();

  return (
    <button
      type="button"
      onClick={toggleMute}
      className="flex h-11 w-11 items-center justify-center"
      aria-label={isMuted ? '사운드 켜기' : '사운드 끄기'}
    >
      <Image src={isMuted ? muteIcon : playIcon} alt="" width={45} height={45} />
    </button>
  );
}
