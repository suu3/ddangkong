'use client';

import { useEffect, useMemo, useState } from 'react';
import MainButton from '@/components/button/MainButton';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import clsx from 'clsx';
import { RealtimeGameType } from '@/lib/realtime/rooms';

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
  const floatingPanelClass = clsx(
    'z-[1001] overflow-hidden rounded-2xl border border-chocolate/20 bg-white/95 shadow-xl backdrop-blur-sm transition-[width,height,padding] duration-300 ease-out',
    'fixed bottom-4 right-4 mb-0 w-full max-w-xs',
    isCollapsed ? 'h-11 w-[76px] px-2 py-1.5' : 'w-64 p-4'
  );

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
    if (confirm('정말 방을 나가시겠습니까?')) {
      const current = new URL(window.location.href);
      current.searchParams.delete('roomId');
      router.push(current.pathname);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
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
  }, [roomId, localActor, hasConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!roomId) return;
    if (!localActor || localActor === 'guest') return;

    const lockKey = `active-room:${gameType}:${localActor}`;
    const lockValue = JSON.stringify({ roomId, updatedAt: Date.now() });

    window.localStorage.setItem(lockKey, lockValue);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== lockKey) return;
      const nextLock = parseRoomLock(event.newValue);

      // 같은 게임에서 다른 방이 활성화되면 현재 탭은 기존 방에서 자동 퇴장
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

  if (!roomId) {
    if (preferFloatingEntry) {
      return (
        <div className={floatingPanelClass}>
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-chocolate hover:bg-chocolate/5 rounded-lg transition-colors"
              title="방 정보 펼치기"
            >
              방 정보
            </button>
          ) : (
            <div className="text-xs relative">
              <button
                onClick={() => setIsCollapsed(true)}
                className="absolute -top-1 -right-1 p-2 text-gray-400 hover:text-chocolate transition-colors"
              >
                닫기
              </button>

              <div className="pr-10 mb-3">
                <p className="font-bold text-sm text-chocolate">{gameLabel} 실시간 공유</p>
              </div>

              {hasConfig ? (
                <>
                  <MainButton className="mb-3" variant="outlined" color="chocolate" onClick={onCreateRoom}>
                    방 만들기
                  </MainButton>

                  {isJoinOpen ? (
                    <form onSubmit={handleJoin} className="flex gap-2">
                      <input
                        type="text"
                        value={inputRoomId}
                        onChange={e => setInputRoomId(e.target.value)}
                        placeholder="방 ID 입력"
                        className="flex-1 px-3 py-2 text-xs border border-chocolate/30 rounded-lg outline-none focus:border-chocolate"
                      />
                      <button type="submit" className="px-3 py-2 text-xs bg-chocolate text-white rounded-lg">
                        참여
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsJoinOpen(false)}
                        className="px-2 py-2 text-xs text-gray-400"
                      >
                        닫기
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsJoinOpen(true)}
                      className="text-[10px] text-chocolate/60 underline underline-offset-2 hover:text-chocolate"
                    >
                      기존 방 ID로 참여하기
                    </button>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-800">
                  실시간 방 기능을 쓰려면 Supabase 공개 환경변수 설정이 필요합니다.
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="px-4 pt-4 flex flex-col gap-2 max-w-[280px] m-auto">
        {hasConfig ? (
          <>
            <MainButton variant="outlined" color="chocolate" onClick={onCreateRoom}>
              {gameLabel} 실시간 공유
            </MainButton>

            {isJoinOpen ? (
              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  type="text"
                  value={inputRoomId}
                  onChange={e => setInputRoomId(e.target.value)}
                  placeholder="방 ID 입력"
                  className="flex-1 px-3 py-2 text-xs border border-chocolate/30 rounded-lg outline-none focus:border-chocolate"
                />
                <button type="submit" className="px-3 py-2 text-xs bg-chocolate text-white rounded-lg">
                  참여
                </button>
                <button type="button" onClick={() => setIsJoinOpen(false)} className="px-2 py-2 text-xs text-gray-400">
                  닫기
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsJoinOpen(true)}
                className="text-[10px] text-chocolate/60 underline underline-offset-2 hover:text-chocolate"
              >
                기존 방 ID로 참여하기
              </button>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            실시간 방 기능을 쓰려면 Supabase 공개 환경변수 설정이 필요합니다.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={floatingPanelClass}>
      {isCollapsed ? (
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-chocolate hover:bg-chocolate/5 rounded-lg transition-colors"
          title="방 정보 펼치기"
        >
          방 정보
        </button>
      ) : (
        <div className="text-xs relative">
          <button
            onClick={() => setIsCollapsed(true)}
            className="absolute -top-1 -right-1 p-2 text-gray-400 hover:text-chocolate transition-colors"
          >
            닫기
          </button>

          <div className="flex items-start justify-between pr-10">
            <div>
              <p className="font-bold text-sm text-chocolate truncate max-w-[140px]">{roomName || '연결된 방'}</p>
              <p className="text-[10px] text-gray-400">ID: {roomId.slice(0, 8)}...</p>
            </div>
            <button onClick={handleLeave} className="text-[10px] mt-1 text-gray-400 hover:text-red-500 underline">
              나가기
            </button>
          </div>

          <div className="space-y-1 mb-4 text-gray-600 border-b border-gray-100 pb-3">
            <p className="flex justify-between">
              <span>최근 조작:</span>
              <span className="font-medium text-gray-900">{lastActor?.slice(0, 10) ?? '-'}</span>
            </p>
            <p className="flex justify-between">
              <span>접속 인원:</span>
              <span className="font-bold text-orange-600">
                {presenceCount} {maxCapacity ? `/ ${maxCapacity}` : ''}명
              </span>
            </p>
          </div>

          <div className="mb-4">
            <p className="text-[9px] text-gray-400 mb-1">방 ID (클릭하여 복사):</p>
            <p
              className="text-[9px] text-gray-500 break-all bg-gray-50 p-1 rounded cursor-pointer hover:bg-gray-100"
              onClick={() => {
                void navigator.clipboard.writeText(roomId);
                alert('방 ID가 복사되었습니다.');
              }}
            >
              {roomId}
            </p>
          </div>

          <MainButton variant="outlined" color="chocolate" onClick={handleCopy}>
            {copied ? '링크 복사됨' : '방 링크 공유'}
          </MainButton>
        </div>
      )}
    </div>
  );
}
