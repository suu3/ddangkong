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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [inputRoomId, setInputRoomId] = useState('');
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const router = useRouter();

  const gameLabel = useMemo(() => getGameLabel(gameType), [gameType]);
  const hasRoom = Boolean(roomId);
  const triggerLabel = hasRoom ? '방 정보' : '방 만들기';

  const floatingPanelClass = 'fixed bottom-4 right-4 z-[1001] flex justify-end';

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
    if (!window.confirm('현재 방에서 나갈까요?')) return;

    const current = new URL(window.location.href);
    current.searchParams.delete('roomId');
    router.push(current.pathname);
  };

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!inputRoomId.trim()) return;

    const current = new URL(window.location.href);
    current.searchParams.set('roomId', inputRoomId.trim());
    router.push(current.toString());
    setIsJoinOpen(false);
    setInputRoomId('');
  };

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
        <div className="rounded-xl border border-chocolate07 px-3 py-3 text-sm leading-6 text-chocolate07">
          실시간 방 기능을 쓰려면 Supabase 설정이 필요합니다.
        </div>
      );
    }

    return (
      <>
        <div className="pr-8">
          <p className="text-base font-bold text-chocolate07">{gameLabel}</p>
          <p className="mt-1 text-sm text-chocolate06">친구들과 바로 공유할 방을 만들 수 있어요.</p>
        </div>

        <MainButton className="mt-4" variant="outlined" color="chocolate" onClick={onCreateRoom}>
          방 만들기
        </MainButton>

        {isJoinOpen ? (
          <form onSubmit={handleJoin} className="mt-3 flex gap-2">
            <input
              type="text"
              value={inputRoomId}
              onChange={event => setInputRoomId(event.target.value)}
              placeholder="방 ID 입력"
              className="flex-1 rounded-lg border border-chocolate07 px-3 py-2 text-sm outline-none focus:border-chocolate07"
            />
            <button type="submit" className="rounded-lg bg-chocolate07 px-3 py-2 text-sm font-semibold text-white">
              참여
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsJoinOpen(true)}
            className="mt-3 text-sm font-medium text-chocolate06 underline underline-offset-2"
          >
            기존 방 ID로 참여하기
          </button>
        )}
      </>
    );
  };

  const renderRoomContent = () => (
    <>
      <div className="flex items-start justify-between gap-3 pr-7">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-chocolate07">{roomName || `${gameLabel} 방`}</p>
          <p className="mt-1 text-sm text-chocolate06">ID: {roomId?.slice(0, 8)}...</p>
        </div>
        <button
          onClick={handleLeave}
          className="shrink-0 text-sm font-medium text-chocolate06 underline underline-offset-2"
        >
          나가기
        </button>
      </div>

      <div className="mt-4 space-y-2 border-b border-chocolate07/20 pb-4 text-sm text-chocolate06">
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

      <div className="mt-4">
        <p className="mb-1 text-sm text-chocolate06">방 ID</p>
        <button
          type="button"
          className="w-full rounded-lg border border-chocolate07 px-3 py-2 text-left text-sm text-chocolate07"
          onClick={() => {
            if (!roomId) return;
            void navigator.clipboard.writeText(roomId);
          }}
        >
          {roomId}
        </button>
      </div>

      <MainButton className="mt-4" variant="outlined" color="chocolate" onClick={handleCopy}>
        {copied ? '링크 복사 완료' : '방 링크 공유'}
      </MainButton>
    </>
  );

  if (!hasRoom && !preferFloatingEntry) {
    return <div className="mx-auto flex max-w-[280px] flex-col gap-3 px-4 pt-4">{renderEntryContent()}</div>;
  }

  return (
    <div className={floatingPanelClass}>
      {isCollapsed ? (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="ml-auto flex h-12 w-[96px] items-center justify-center rounded-2xl border border-chocolate07 bg-white px-2 text-sm font-semibold text-chocolate07 shadow-sm transition-colors hover:bg-chocolate07 hover:text-white"
          title={triggerLabel}
        >
          {triggerLabel}
        </button>
      ) : (
        <div className="relative rounded-2xl border border-chocolate07 bg-white p-4 text-sm shadow-lg transition-all duration-200 ease-out animate-[fade-in_180ms_ease-out]">
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="absolute -right-1 -top-1 p-2 text-sm text-chocolate06 transition-colors hover:text-chocolate07"
          >
            닫기
          </button>
          {hasRoom ? renderRoomContent() : renderEntryContent()}
        </div>
      )}
    </div>
  );
}
