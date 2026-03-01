'use client';

import { useEffect, useMemo, useState } from 'react';
import MainButton from '@/components/button/MainButton';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import clsx from 'clsx';

interface RoomSharePanelProps {
  gameType: 'coffee' | 'roulette';
  roomId: string | null;
  localActor: string;
  hasConfig: boolean;
  lastActor?: string | null;
  roomTitle?: string | null;
  maxPlayers?: number | null;
  onCreateRoom: () => Promise<void>;
}

export default function RoomSharePanel({
  gameType,
  roomId,
  localActor,
  hasConfig,
  onCreateRoom,
  lastActor,
  roomTitle,
  maxPlayers,
}: RoomSharePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const router = useRouter();

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

  useEffect(() => {
    if (!roomId || !hasConfig) return;

    const channel = supabase.channel(`presence:${roomId}`);
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceCount(Object.keys(state).length);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ actor: localActor });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, localActor, hasConfig]);

  if (!hasConfig) return null;

  if (!roomId) {
    return (
      <div className="px-4 pt-4 relative z-[100]">
        <MainButton variant="outlined" color="chocolate" onClick={onCreateRoom}>
          {gameType === 'coffee' ? '커피내기 실시간 공유' : '룰렛 실시간 공유'}
        </MainButton>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'fixed top-4 right-4 z-[100] bg-white/95 backdrop-blur-sm border border-chocolate/20 rounded-2xl shadow-xl transition-all duration-300',
        isCollapsed ? 'w-12 h-12' : 'w-64 p-4'
      )}
    >
      {isCollapsed ? (
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full h-full flex items-center justify-center text-xl hover:bg-chocolate/5 transition-colors"
          title="방 정보 펼치기"
        >
          📡
        </button>
      ) : (
        <div className="text-xs relative">
          <button
            onClick={() => setIsCollapsed(true)}
            className="absolute -top-1 -right-1 p-2 text-gray-400 hover:text-chocolate transition-colors"
          >
            ✕
          </button>

          <div className="flex justify-between items-start mb-3 pr-6">
            <div>
              <p className="font-bold text-sm text-chocolate truncate max-w-[140px]">{roomTitle || '연결된 방'}</p>
              <p className="text-[10px] text-gray-400">ID: {localActor.slice(0, 8)}...</p>
            </div>
            <button onClick={handleLeave} className="text-[10px] text-gray-400 hover:text-red-500 underline">
              나가기
            </button>
          </div>

          <div className="space-y-1 mb-4 text-gray-600">
            <p className="flex justify-between">
              <span>최근 조작:</span>
              <span className="font-medium text-gray-900">{lastActor?.slice(0, 10) ?? '-'}</span>
            </p>
            <p className="flex justify-between">
              <span>접속 인원:</span>
              <span className="font-bold text-orange-600">
                {presenceCount} {maxPlayers ? `/ ${maxPlayers}` : ''} 명
              </span>
            </p>
          </div>

          <MainButton variant="outlined" color="chocolate" onClick={handleCopy}>
            {copied ? '링크 복사됨!' : '방 링크 공유'}
          </MainButton>
        </div>
      )}
    </div>
  );
}
