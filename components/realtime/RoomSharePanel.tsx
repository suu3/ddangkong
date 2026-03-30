'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import MainButton from '@/components/button/MainButton';
import { RealtimeGameType } from '@/lib/realtime/rooms';
import { supabase } from '@/lib/supabase/client';

interface RoomSharePanelProps {
  gameType: RealtimeGameType;
  roomId: string | null;
  localActor: string;
  hasConfig: boolean;
  preferFloatingEntry?: boolean;
  lastActor?: string | null;
  roomName?: string | null;
  maxCapacity?: number | null;
  onCreateRoom: () => Promise<void>;
}

const getGameLabel = (gameType: RealtimeGameType) => {
  if (gameType === 'coffee') return '커피내기';
  if (gameType === 'roulette') return '룰렛';
  if (gameType === 'hot_potato') return '폭탄 돌리기';
  return '팀 나누기';
};

export default function RoomSharePanel({
  gameType,
  roomId,
  localActor,
  hasConfig,
  preferFloatingEntry = false,
  onCreateRoom,
  lastActor,
  roomName,
  maxCapacity,
}: RoomSharePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [inputRoomId, setInputRoomId] = useState('');
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const router = useRouter();

  const gameLabel = useMemo(() => getGameLabel(gameType), [gameType]);
  const hasRoom = Boolean(roomId);
  const triggerLabel = hasRoom ? '방 정보' : '방 만들기';

  const parseRoomLock = (value: string | null): { roomId?: string } | null => {
    if (!value) return null;

    try {
      return JSON.parse(value) as { roomId?: string };
    } catch {
      return null;
    }
  };

  const shareUrl = useMemo(() => {
    if (!roomId || typeof window === 'undefined') return '';
    const current = new URL(window.location.href);
    current.searchParams.set('roomId', roomId);
    return current.toString();
  }, [roomId]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLeave = () => {
    if (!window.confirm('현재 방에서 나가시겠어요?')) return;

    const current = new URL(window.location.href);
    current.searchParams.delete('roomId');
    setIsOpen(false);
    router.push(current.pathname);
  };

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!inputRoomId.trim()) return;

    const current = new URL(window.location.href);
    current.searchParams.set('roomId', inputRoomId.trim());
    router.push(current.toString());
    setInputRoomId('');
    setIsJoinOpen(false);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!roomId || !hasConfig) return;

    const channel = supabase.channel(`presence:${roomId}`);
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceCount(Object.keys(state).length);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ actor: localActor });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hasConfig, localActor, roomId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!roomId) return;
    if (!localActor || localActor === 'guest') return;

    const lockKey = `active-room:${gameType}:${localActor}`;
    window.localStorage.setItem(lockKey, JSON.stringify({ roomId, updatedAt: Date.now() }));

    const onStorage = (event: StorageEvent) => {
      if (event.key !== lockKey) return;
      const nextLock = parseRoomLock(event.newValue);

      if (nextLock?.roomId && nextLock.roomId !== roomId) {
        const current = new URL(window.location.href);
        current.searchParams.delete('roomId');
        router.push(current.pathname);
      }
    };

    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      const currentLock = parseRoomLock(window.localStorage.getItem(lockKey));
      if (currentLock?.roomId === roomId) {
        window.localStorage.removeItem(lockKey);
      }
    };
  }, [gameType, localActor, roomId, router]);

  const renderEntryContent = () => {
    if (!hasConfig) {
      return (
        <div className="rounded-2xl border border-chocolate07 bg-white px-4 py-4 text-sm leading-6 text-chocolate07">
          실시간 방 기능을 쓰려면 Supabase 설정이 필요합니다.
        </div>
      );
    }

    return (
      <>
        <div className="rounded-[1.75rem] border border-chocolate07/20 bg-[#fffaf4] p-5">
          <p className="text-lg font-bold text-chocolate07">{gameLabel}</p>
          <p className="mt-2 text-sm leading-6 text-chocolate06">
            친구와 바로 공유할 방을 만들거나, 받은 방 ID로 바로 참여해보세요.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MainButton variant="contained" color="chocolate" onClick={onCreateRoom}>
            방 만들기
          </MainButton>
          <button
            type="button"
            onClick={() => setIsJoinOpen(prev => !prev)}
            className="flex h-12 items-center justify-center rounded-2xl border border-chocolate07 bg-white px-4 text-sm font-semibold text-chocolate07 transition-colors hover:bg-[#fff7ec]"
          >
            기존 방 참여하기
          </button>
        </div>

        {isJoinOpen ? (
          <form onSubmit={handleJoin} className="rounded-[1.5rem] border border-chocolate07/20 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-chocolate06">방 ID 입력</label>
            <input
              type="text"
              value={inputRoomId}
              onChange={event => setInputRoomId(event.target.value)}
              placeholder="방 ID 입력"
              className="w-full rounded-xl border border-chocolate07 px-3 py-3 text-sm outline-none focus:border-chocolate07"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-chocolate07 px-3 py-2 text-sm font-semibold text-white"
              >
                참여
              </button>
              <button
                type="button"
                onClick={() => setIsJoinOpen(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-chocolate07 px-3 py-2 text-sm font-semibold text-chocolate07"
              >
                닫기
              </button>
            </div>
          </form>
        ) : null}
      </>
    );
  };

  const renderRoomContent = () => (
    <>
      <div className="rounded-[1.75rem] border border-chocolate07/20 bg-[#fffaf4] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-chocolate07">{roomName || `${gameLabel} 방`}</p>
            <p className="mt-1 text-sm text-chocolate06">ID: {roomId?.slice(0, 8)}...</p>
          </div>
          <button
            onClick={handleLeave}
            className="shrink-0 text-sm font-medium text-chocolate06 underline underline-offset-2"
          >
            나가기
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-[1.75rem] border border-chocolate07/15 bg-white p-5 text-sm text-chocolate06">
        <p className="flex justify-between gap-3">
          <span>최근 조작</span>
          <span className="truncate font-semibold text-chocolate07">{lastActor?.slice(0, 10) ?? '-'}</span>
        </p>
        <p className="flex justify-between gap-3">
          <span>접속 인원</span>
          <span className="font-semibold text-chocolate07">
            {presenceCount}
            {maxCapacity ? ` / ${maxCapacity}` : ''}명
          </span>
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-chocolate07/15 bg-white p-5">
        <p className="mb-2 text-sm text-chocolate06">방 ID</p>
        <button
          type="button"
          className="w-full rounded-xl border border-chocolate07 px-3 py-3 text-left text-sm text-chocolate07"
          onClick={() => {
            if (!roomId) return;
            void navigator.clipboard.writeText(roomId);
          }}
        >
          {roomId}
        </button>
      </div>

      <MainButton variant="outlined" color="chocolate" onClick={handleCopy}>
        {copied ? '링크 복사 완료' : '방 링크 공유'}
      </MainButton>
    </>
  );

  if (!preferFloatingEntry && !hasRoom) {
    return <div className="mx-auto flex max-w-[280px] flex-col gap-3 px-4 pt-4">{renderEntryContent()}</div>;
  }

  return (
    <>
      <div className="fixed right-24 top-[0.375rem] z-[1001] flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={clsx(
            'flex h-9 min-w-[72px] items-center justify-center rounded-md px-2 text-sm font-semibold transition-colors',
            hasRoom
              ? 'text-chocolate07 hover:bg-chocolate07/10 hover:text-chocolate06'
              : 'text-chocolate07 hover:bg-chocolate07/10 hover:text-chocolate06'
          )}
          title={triggerLabel}
        >
          {triggerLabel}
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[1002]">
          <button
            type="button"
            aria-label="Close room modal"
            className="absolute inset-0 bg-black/45"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 top-[var(--global-navigation-height)] overflow-y-auto bg-white">
            <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-chocolate06">Room</p>
                  <h2 className="mt-2 text-2xl font-bold text-chocolate07">
                    {hasRoom ? '방을 공유하거나 관리해보세요' : `${gameLabel} 방을 만들어볼까요?`}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-chocolate07 bg-white px-4 py-2 text-sm font-medium text-chocolate07"
                >
                  닫기
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-4">{hasRoom ? renderRoomContent() : renderEntryContent()}</div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
