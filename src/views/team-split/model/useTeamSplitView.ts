'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoom, createRoom, roomErrorMessage } from '@/src/entities/room';

import { getServerActor } from '@/src/entities/room';
import { useSound } from '@/lib/context/sound';
import { parseNames, normalizeNames, splitTeams } from '@/src/shared/lib/party-members';

export type TeamCount = 2 | 3 | 4;

export interface TeamSplitState {
  revision: number;
  lastActor: string | null;
  hostId: string;
  members: string[];
  teamCount: TeamCount;
  result: string[][];
  lastShuffledAt: number | null;
}

export interface UiError {
  code: string;
  message: string;
}

export type MutateResult = {
  nextState: TeamSplitState;
  error?: UiError;
};

export const MIN_MEMBERS = 2;

export const TEAM_LABELS = ['A', 'B', 'C', 'D'] as const;

export const INITIAL_STATE = (hostId: string): TeamSplitState => ({
  revision: 0,
  lastActor: hostId,
  hostId,
  members: [],
  teamCount: 2,
  result: [[], []],
  lastShuffledAt: null,
});

export function useTeamSplitView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const isRealtimeEnabled = Boolean(roomId);
  const [localActor, setClientActor] = useState('guest');
  const live = useRoom<TeamSplitState>(roomId, 'team_split');
  const { isHost, mutate } = live;
  const clientActor = roomId ? live.actorId : localActor;
  const [errorBanner, setErrorBanner] = useState<UiError | null>(null);
  const [membersText, setMembersText] = useState('');
  const [hasEntered, setHasEntered] = useState(false);
  const [localTeamCount, setLocalTeamCount] = useState<TeamCount>(2);
  const [localResult, setLocalResult] = useState<string[][]>([[], []]);
  const [localLastShuffledAt, setLocalLastShuffledAt] = useState<number | null>(null);
  const localGameState = INITIAL_STATE('guest');
  const realtimeState = roomId ? (live.state ?? localGameState) : localGameState;
  const roomInfo = { name: live.room?.name ?? null, maxCapacity: live.room?.maxCapacity ?? null };
  const { isMuted } = useSound();
  const shuffleAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevShuffledAtRef = useRef<number | null | undefined>(undefined);
  const currentTeamCount = isRealtimeEnabled ? realtimeState.teamCount : localTeamCount;
  const currentResult = isRealtimeEnabled ? realtimeState.result : localResult;
  const currentLastShuffledAt = isRealtimeEnabled ? realtimeState.lastShuffledAt : localLastShuffledAt;
  const parsedMembers = useMemo(() => normalizeNames(parseNames(membersText)), [membersText]);
  const showIntro = !isRealtimeEnabled && !hasEntered;
  const pushRealtimeState = useCallback(
    async (mutator: (current: TeamSplitState) => MutateResult) => {
      if (!roomId || !isHost) return false;
      try {
        await mutate(current => {
          const result = mutator(current);
          if (result.error) {
            setErrorBanner(result.error);
            throw new Error(result.error.message);
          }
          return result.nextState;
        });
        return true;
      } catch (error) {
        setErrorBanner({
          code: 'ERR_UPDATE_FAILED',
          message: roomErrorMessage(error instanceof Error ? error.message : null) ?? '변경하지 못했어요.',
        });
        return false;
      }
    },
    [roomId, isHost, mutate]
  );
  const handleCreateRoom = async () => {
    const resolvedActor = clientActor === 'guest' ? await getServerActor() : clientActor;
    if (clientActor === 'guest' && resolvedActor !== 'guest') {
      setClientActor(resolvedActor);
    }

    const initial = {
      ...INITIAL_STATE(resolvedActor),
      members: parsedMembers,
      teamCount: currentTeamCount,
      result: Array.from({ length: currentTeamCount }, () => [] as string[]),
    };
    const room = await createRoom('team_split', initial, { name: '팀 나누기 방' });
    router.push(`/team-split?roomId=${room.id}`);
  };
  const handleMembersChange = async (names: string[]): Promise<boolean> => {
    const members = normalizeNames(names);
    if (members.length > 100 || members.some(name => name.length > 40)) {
      setErrorBanner({ code: 'ERR_MEMBERS', message: '최대 100명, 이름은 40자까지 입력할 수 있어요.' });
      return false;
    }
    setErrorBanner(null);
    if (isRealtimeEnabled) {
      const success = await pushRealtimeState(current => ({ nextState: { ...current, members } }));
      if (!success) return false;
    }
    setMembersText(members.join('\n'));
    return true;
  };
  const handleTeamCountChange = async (teamCount: TeamCount) => {
    setErrorBanner(null);
    if (teamCount > parsedMembers.length) return;

    if (isRealtimeEnabled) {
      await pushRealtimeState(current => ({
        nextState: {
          ...current,
          teamCount,
          result: Array.from({ length: teamCount }, () => [] as string[]),
          lastShuffledAt: null,
        },
      }));
      return;
    }

    setLocalTeamCount(teamCount);
    setLocalResult(Array.from({ length: teamCount }, () => [] as string[]));
    setLocalLastShuffledAt(null);
  };
  const handleSplit = async () => {
    setErrorBanner(null);

    const nextMembers = normalizeNames(parseNames(membersText));
    if (nextMembers.length < MIN_MEMBERS) {
      setErrorBanner({
        code: 'ERR_MIN_MEMBERS',
        message: '최소 2명 이상 입력해야 팀을 나눌 수 있어요.',
      });
      return;
    }

    if (nextMembers.length < currentTeamCount) {
      setErrorBanner({
        code: 'ERR_TEAM_COUNT',
        message: '팀 수보다 참여자가 적어요. 인원을 추가하거나 팀 수를 줄여주세요.',
      });
      return;
    }
    const nextResult = splitTeams(nextMembers, currentTeamCount);
    const now = Date.now();
    setMembersText(nextMembers.join('\n'));

    if (isRealtimeEnabled) {
      await pushRealtimeState(current => ({
        nextState: {
          ...current,
          members: nextMembers,
          result: nextResult,
          lastShuffledAt: now,
        },
      }));
      return;
    }

    setLocalResult(nextResult);
    setLocalLastShuffledAt(now);
  };
  useEffect(() => {
    let mounted = true;

    getServerActor().then(actor => {
      if (!mounted) return;
      setClientActor(actor);
    });

    return () => {
      mounted = false;
    };
  }, []);
  const syncedMembersText = realtimeState.members.join('\n');
  useEffect(() => {
    if (!isRealtimeEnabled) return;
    setMembersText(syncedMembersText);
  }, [isRealtimeEnabled, syncedMembersText]);
  useEffect(() => {
    const audio = new window.Audio('/sound/shuffling.mp3');
    audio.preload = 'auto';
    audio.volume = 0.6;
    shuffleAudioRef.current = audio;

    return () => {
      audio.pause();
      shuffleAudioRef.current = null;
    };
  }, []);
  useEffect(() => {
    const prev = prevShuffledAtRef.current;
    prevShuffledAtRef.current = currentLastShuffledAt;

    if (prev === undefined || currentLastShuffledAt === null || currentLastShuffledAt === prev) return;
    if (isMuted) return;

    const audio = shuffleAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [currentLastShuffledAt, isMuted]);
  return {
    roomId,
    isRealtimeEnabled,
    live,
    isHost,
    clientActor,
    errorBanner,
    membersText,
    handleMembersChange,
    setHasEntered,
    realtimeState,
    roomInfo,
    currentTeamCount,
    currentResult,
    currentLastShuffledAt,
    parsedMembers,
    showIntro,
    handleCreateRoom,
    handleTeamCountChange,
    handleSplit,
  };
}
