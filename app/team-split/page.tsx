'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MainButton from '@/components/button/MainButton';
import Tooltip from '@/components/Tooltip';
import UniqueText from '@/components/UniqueText';
import RoomSharePanel from '@/components/realtime/RoomSharePanel';
import { subscribeRoomState } from '@/lib/realtime/channel';
import { getServerActor } from '@/lib/realtime/clientActor';
import { createRoom, getRoom, updateRoomState } from '@/lib/realtime/rooms';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import teamSplitImage from '@/public/split-team/main.png';

type TeamCount = 2 | 3 | 4;

interface TeamSplitState {
  revision: number;
  lastActor: string | null;
  hostId: string;
  members: string[];
  teamCount: TeamCount;
  result: string[][];
  lastShuffledAt: number | null;
}

interface UiError {
  code: string;
  message: string;
}

type MutateResult = {
  nextState: TeamSplitState;
  error?: UiError;
};

const MIN_MEMBERS = 2;
const TEAM_LABELS = ['A', 'B', 'C', 'D'] as const;

const INITIAL_STATE = (hostId: string): TeamSplitState => ({
  revision: 0,
  lastActor: hostId,
  hostId,
  members: [],
  teamCount: 2,
  result: [[], []],
  lastShuffledAt: null,
});

function TeamSplitPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const isRealtimeEnabled = Boolean(roomId);

  const [clientActor, setClientActor] = useState('guest');
  const [errorBanner, setErrorBanner] = useState<UiError | null>(null);
  const [membersText, setMembersText] = useState('');
  const [hasEntered, setHasEntered] = useState(false);

  const [localTeamCount, setLocalTeamCount] = useState<TeamCount>(2);
  const [localResult, setLocalResult] = useState<string[][]>([[], []]);
  const [localLastShuffledAt, setLocalLastShuffledAt] = useState<number | null>(null);

  const [realtimeState, setRealtimeState] = useState<TeamSplitState>(() => INITIAL_STATE('guest'));
  const realtimeStateRef = useRef<TeamSplitState>(INITIAL_STATE('guest'));
  const [roomInfo, setRoomInfo] = useState<{ name: string | null; maxCapacity: number | null }>({
    name: null,
    maxCapacity: null,
  });
  const sendStateRef = useRef<((state: TeamSplitState) => void) | null>(null);

  const currentTeamCount = isRealtimeEnabled ? realtimeState.teamCount : localTeamCount;
  const currentResult = isRealtimeEnabled ? realtimeState.result : localResult;
  const currentLastShuffledAt = isRealtimeEnabled ? realtimeState.lastShuffledAt : localLastShuffledAt;
  const parsedMembers = useMemo(() => parseAndNormalizeMembers(membersText), [membersText]);
  const showIntro = !isRealtimeEnabled && !hasEntered;

  const applyRealtimeState = useCallback((nextState: TeamSplitState) => {
    realtimeStateRef.current = nextState;
    setRealtimeState(nextState);
  }, []);

  const pushRealtimeState = useCallback(
    async (mutator: (current: TeamSplitState) => MutateResult) => {
      if (!roomId) return false;

      const previous = realtimeStateRef.current;
      const result = mutator(previous);

      if (result.error) {
        setErrorBanner(result.error);
        return false;
      }

      const optimisticState: TeamSplitState = {
        ...result.nextState,
        revision: previous.revision + 1,
        lastActor: clientActor,
      };

      applyRealtimeState(optimisticState);
      sendStateRef.current?.(optimisticState);

      try {
        await updateRoomState(roomId, optimisticState, previous.revision);
        return true;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('Realtime conflict')) {
          applyRealtimeState(previous);
          return false;
        }

        const latest = await getRoom<TeamSplitState>(roomId);
        if (!latest) {
          applyRealtimeState(previous);
          return false;
        }

        const latestState = latest.game_state;
        applyRealtimeState(latestState);

        const retryResult = mutator(latestState);
        if (retryResult.error) {
          setErrorBanner(retryResult.error);
          return false;
        }

        const retryState: TeamSplitState = {
          ...retryResult.nextState,
          revision: latestState.revision + 1,
          lastActor: clientActor,
        };

        applyRealtimeState(retryState);
        sendStateRef.current?.(retryState);

        try {
          await updateRoomState(roomId, retryState, latestState.revision);
          return true;
        } catch {
          applyRealtimeState(latestState);
          return false;
        }
      }
    },
    [applyRealtimeState, clientActor, roomId]
  );

  const handleCreateRoom = async () => {
    const resolvedActor = clientActor === 'guest' ? await getServerActor() : clientActor;
    if (clientActor === 'guest' && resolvedActor !== 'guest') {
      setClientActor(resolvedActor);
    }

    const initial = INITIAL_STATE(resolvedActor);
    const room = await createRoom('team_split', initial, { name: '팀 나누기 방' });
    router.push(`/team-split?roomId=${room.id}`);
  };

  const handleTeamCountChange = async (teamCount: TeamCount) => {
    setErrorBanner(null);

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

    const nextMembers = parseAndNormalizeMembers(membersText);
    if (nextMembers.length < MIN_MEMBERS) {
      setErrorBanner({
        code: 'ERR_MIN_MEMBERS',
        message: '최소 2명 이상 입력해야 팀을 나눌 수 있어요.',
      });
      return;
    }

    const nextResult = splitIntoTeams(nextMembers, currentTeamCount);
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

  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    getRoom<TeamSplitState>(roomId).then(room => {
      if (!mounted || !room) return;
      applyRealtimeState(room.game_state);
      setRoomInfo({ name: room.name, maxCapacity: room.max_capacity });
    });

    const { unsubscribe, sendState } = subscribeRoomState<TeamSplitState>({
      roomId,
      onState: state => {
        if (!mounted) return;
        applyRealtimeState(state);
      },
    });

    sendStateRef.current = sendState;

    return () => {
      mounted = false;
      unsubscribe();
      sendStateRef.current = null;
    };
  }, [applyRealtimeState, roomId]);

  useEffect(() => {
    if (!isRealtimeEnabled) return;
    setMembersText(realtimeState.members.join('\n'));
  }, [isRealtimeEnabled, realtimeState.members]);

  return (
    <div className="relative px-4 pb-28 pt-10">
      {showIntro ? (
        <section className="relative mx-auto flex max-w-xl flex-col items-center justify-center text-center">
          <UniqueText Tag="h1" font="sans" size="lg" className="relative mt-4 text-center text-chocolate">
            랜덤 팀
            <br />
            <span className="text-[3.625rem] leading-[103.8%]">나누기</span>
          </UniqueText>
          <div className="relative mt-8 w-full max-w-[20rem]">
            <Image
              src={teamSplitImage}
              alt="팀 나누기 메인 일러스트"
              priority
              className="relative mx-auto w-full max-w-[18rem] animate-[float_4.8s_ease-in-out_infinite]"
            />
          </div>
          <div className="relative mt-10 w-full max-w-[15rem]">
            <div className="absolute left-1/2 top-[calc(-100%)] -translate-x-1/2 -translate-y-2">
              <Tooltip className="animate-bounce" visible>
                Click !
              </Tooltip>
            </div>
            <MainButton onClick={() => setHasEntered(true)} variant="contained" color="chocolate">
              시작하기
            </MainButton>
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-xl rounded-[2rem] border border-chocolate07 bg-white p-5 shadow-sm">
          <UniqueText Tag="h1" font="sans" size="lg" className="text-center text-chocolate">
            랜덤 팀
            <br />
            <span className="text-[3.625rem] leading-[103.8%]">나누기</span>
          </UniqueText>

          {errorBanner && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorBanner.message}
            </div>
          )}

          <section className="mt-5 rounded-[1.5rem] border border-chocolate07 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-800">참여자 입력</h2>
            <p className="mt-1 text-xs text-gray-500">한 줄에 한 명씩 입력하세요. 현재 {parsedMembers.length}명</p>
            <textarea
              value={membersText}
              onChange={event => setMembersText(event.target.value)}
              placeholder={'민지\n현우\n유진\n서준\n도윤\n지우'}
              className="mt-3 h-48 w-full resize-none rounded-[1.25rem] border border-chocolate07 bg-white p-3 text-sm outline-none transition-colors focus:border-chocolate07"
            />
          </section>

          <section className="mt-4 rounded-[1.5rem] border border-chocolate07 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-800">옵션</h2>
            <div className="mt-3 flex gap-2">
              {[2, 3, 4].map(option => {
                const selected = currentTeamCount === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void handleTeamCountChange(option as TeamCount)}
                    aria-pressed={selected}
                    className={clsx(
                      'h-11 flex-1 rounded-full border-2 text-sm font-semibold transition-all duration-150',
                      selected
                        ? 'border-chocolate07 bg-chocolate07 text-white'
                        : 'border-chocolate07 bg-white text-chocolate07'
                    )}
                  >
                    {option}팀
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <MainButton variant="contained" color="chocolate" onClick={() => void handleSplit()}>
                팀 나누기
              </MainButton>
            </div>
          </section>

          <section className="mt-4 rounded-[1.5rem] border border-chocolate07 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-chocolate07">결과</h2>
              {currentLastShuffledAt && (
                <p className="text-xs text-chocolate06">
                  최근 실행 {new Date(currentLastShuffledAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentResult.map((teamMembers, index) => (
                <div key={TEAM_LABELS[index]} className="rounded-[1.25rem] border border-chocolate07 bg-white p-3">
                  <p className="text-sm font-bold text-chocolate07">TEAM {TEAM_LABELS[index]}</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-700">
                    {teamMembers.length === 0 ? (
                      <li className="text-gray-400">아직 결과가 없어요</li>
                    ) : (
                      teamMembers.map(member => <li key={`${TEAM_LABELS[index]}-${member}`}>{member}</li>)
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <RoomSharePanel
        gameType="team_split"
        roomId={roomId}
        localActor={clientActor}
        hasConfig={hasSupabaseConfig()}
        preferFloatingEntry
        onCreateRoom={handleCreateRoom}
        lastActor={isRealtimeEnabled ? realtimeState.lastActor : clientActor}
        roomName={roomInfo.name}
        maxCapacity={roomInfo.maxCapacity}
      />
    </div>
  );
}

export default function TeamSplitPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen" />}>
      <TeamSplitPageContent />
    </Suspense>
  );
}

function parseAndNormalizeMembers(input: string): string[] {
  const counts = new Map<string, number>();
  const normalizedMembers: string[] = [];

  input
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(Boolean)
    .forEach(name => {
      const key = name.toLocaleLowerCase();
      const nextCount = (counts.get(key) ?? 0) + 1;
      counts.set(key, nextCount);

      normalizedMembers.push(nextCount === 1 ? name : `${name} (${nextCount})`);
    });

  return normalizedMembers;
}

function splitIntoTeams(members: string[], teamCount: TeamCount): string[][] {
  const shuffled = shuffle([...members]);
  const base = Math.floor(shuffled.length / teamCount);
  const remainder = shuffled.length % teamCount;

  const teams: string[][] = [];
  let cursor = 0;

  for (let index = 0; index < teamCount; index += 1) {
    const targetSize = base + (index < remainder ? 1 : 0);
    teams.push(shuffled.slice(cursor, cursor + targetSize));
    cursor += targetSize;
  }

  return teams;
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }

  return items;
}
