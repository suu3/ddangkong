'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import MainButton from '@/components/button/MainButton';
import { buildActorAliasMap, consumeActorRotationNotice, getActorAlias } from '@/lib/realtime/clientActor';
import { assertJoinableRoom, getGameLabel, normalizeRoomId, RealtimeGameType } from '@/lib/realtime/rooms';
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
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [presenceActors, setPresenceActors] = useState<string[]>([]);
  const [inputRoomId, setInputRoomId] = useState('');
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showActorNotice, setShowActorNotice] = useState(false);
  const router = useRouter();

  const gameLabel = useMemo(() => getGameLabel(gameType), [gameType]);
  const hasRoom = Boolean(roomId);
  const triggerLabel = hasRoom ? '방 정보' : '방 만들기';

  const aliasMap = useMemo(
    () => buildActorAliasMap([...presenceActors, localActor, ...(lastActor ? [lastActor] : [])]),
    [lastActor, localActor, presenceActors]
  );
  const presenceCount = presenceActors.length || 1;

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

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (isJoiningRoom) return;

    const normalizedRoomId = normalizeRoomId(inputRoomId);
    if (!normalizedRoomId) {
      setJoinError('방 ID 형식이 올바르지 않아요. 공유받은 링크나 ID를 그대로 붙여넣어 주세요.');
      return;
    }

    setJoinError(null);
    setIsJoiningRoom(true);

    try {
      await assertJoinableRoom(normalizedRoomId, gameType);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : '방에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    } finally {
      setIsJoiningRoom(false);
    }

    const current = new URL(window.location.href);
    current.searchParams.set('roomId', normalizedRoomId);
    router.push(current.toString());
    setInputRoomId('');
    setIsJoinOpen(false);
    setIsOpen(false);
    setCreateRoomError(null);
  };

  const handleCreateRoomClick = async () => {
    if (isCreatingRoom) return;

    setCreateRoomError(null);
    setJoinError(null);
    setIsJoinOpen(false);
    setIsCreatingRoom(true);

    try {
      await onCreateRoom();
    } catch (error) {
      setCreateRoomError(
        error instanceof Error ? error.message : '방을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setIsCreatingRoom(false);
    }
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
        const actors = new Set<string>();

        Object.values(state).forEach(presences => {
          const first = (presences as Array<{ actor?: string }>)[0];
          if (first?.actor) {
            actors.add(first.actor);
          }
        });

        setPresenceActors(Array.from(actors));
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

  useEffect(() => {
    if (!hasRoom) return;
    setCreateRoomError(null);
    setIsCreatingRoom(false);
  }, [hasRoom]);

  useEffect(() => {
    if (!localActor || localActor === 'guest') return;
    if (!consumeActorRotationNotice()) return;

    setShowActorNotice(true);
  }, [localActor]);

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
            친구와 바로 공유할 방을 만들거나, 받은 방 ID로 바로 참여해 보세요.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MainButton
            variant="contained"
            color="chocolate"
            onClick={() => void handleCreateRoomClick()}
            disabled={isCreatingRoom}
          >
            {isCreatingRoom ? '방 만드는 중...' : '방 만들기'}
          </MainButton>
          <button
            type="button"
            onClick={() => {
              setCreateRoomError(null);
              setIsJoinOpen(prev => !prev);
            }}
            className="flex h-12 items-center justify-center rounded-2xl border border-chocolate07 bg-white px-4 text-sm font-semibold text-chocolate07 transition-colors hover:bg-[#fff7ec]"
          >
            기존 방 참여하기
          </button>
        </div>

        {createRoomError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {createRoomError}
          </div>
        ) : null}

        {isJoinOpen ? (
          <form
            onSubmit={event => void handleJoin(event)}
            className="rounded-[1.5rem] border border-chocolate07/20 bg-white p-4"
          >
            <label className="mb-2 block text-sm font-medium text-chocolate06">방 ID 또는 링크 입력</label>
            <input
              type="text"
              value={inputRoomId}
              onChange={event => {
                setInputRoomId(event.target.value);
                setJoinError(null);
              }}
              placeholder="방 ID 또는 공유받은 링크"
              className="w-full rounded-xl border border-chocolate07 px-3 py-3 text-sm outline-none focus:border-chocolate07"
            />
            {joinError ? <p className="mt-2 text-sm leading-6 text-red-700">{joinError}</p> : null}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={isJoiningRoom}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-chocolate07 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isJoiningRoom ? '확인 중...' : '참여'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsJoinOpen(false);
                  setJoinError(null);
                }}
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
            type="button"
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
          <span className="truncate font-semibold text-chocolate07">
            {getActorAlias(lastActor, aliasMap, localActor)}
          </span>
        </p>
        <p className="flex justify-between gap-3">
          <span>접속 인원</span>
          <span className="font-semibold text-chocolate07">
            {presenceCount}
            {maxCapacity ? ` / ${maxCapacity}` : ''}명
          </span>
        </p>
        {presenceActors.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t border-chocolate07/10 pt-3">
            {presenceActors.map(actor => (
              <span key={actor} className="rounded-full bg-[#fff3e3] px-3 py-1 text-xs font-semibold text-chocolate07">
                {getActorAlias(actor, aliasMap, localActor)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {showActorNotice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          접속 정보가 만료되어 새 익명 ID가 발급됐어요. 이전에 참여하던 방에서는 다른 사람으로 표시될 수 있어요.
        </div>
      ) : null}

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
            'text-chocolate07 hover:bg-chocolate07/10 hover:text-chocolate06'
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
                    {hasRoom ? '방을 공유하거나 관리해 보세요.' : `${gameLabel} 방을 만들어 볼까요?`}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="shrink-0 whitespace-nowrap rounded-full border border-chocolate07 bg-white px-4 py-2 text-sm font-medium text-chocolate07"
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
