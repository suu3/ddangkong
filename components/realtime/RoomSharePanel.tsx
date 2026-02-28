'use client';

import { useMemo, useState } from 'react';
import MainButton from '@/components/button/MainButton';

interface RoomSharePanelProps {
  gameType: 'coffee' | 'roulette';
  roomId: string | null;
  role: 'host' | 'viewer';
  hasConfig: boolean;
  onCreateRoom: () => Promise<void>;
}

export default function RoomSharePanel({ gameType, roomId, role, hasConfig, onCreateRoom }: RoomSharePanelProps) {
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const shareUrl = useMemo(() => {
    if (!roomId || typeof window === 'undefined') return '';
    const current = new URL(window.location.href);
    current.searchParams.set('roomId', roomId);
    current.searchParams.set('role', 'viewer');
    return current.toString();
  }, [roomId]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreateRoom();
    } finally {
      setIsCreating(false);
    }
  };

  if (!hasConfig) {
    return <p className="text-xs text-red-500 px-4 pt-4">Supabase 환경변수를 설정해주세요.</p>;
  }

  if (!roomId) {
    return (
      <div className="px-4 pt-4">
        <MainButton variant="outlined" color="chocolate" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? '방 생성 중...' : `${gameType === 'coffee' ? '커피내기' : '룰렛'} 방 만들기`}
        </MainButton>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 text-xs">
      <p className="font-bold">방 연결됨 ({role === 'host' ? '호스트' : '참여자'})</p>
      <p className="break-all">roomId: {roomId}</p>
      {role === 'host' && (
        <MainButton className="mt-2" variant="outlined" color="chocolate" onClick={handleCopy}>
          {copied ? '링크 복사됨!' : '참여 링크 복사'}
        </MainButton>
      )}
    </div>
  );
}
