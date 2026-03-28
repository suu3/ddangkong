'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import MainButton from '@/components/button/MainButton';
import Tooltip from '@/components/Tooltip';
import UniqueText from '@/components/UniqueText';
import RoomSharePanel from '@/components/realtime/RoomSharePanel';
import { createRoom, getRoom, updateRoomState } from '@/lib/realtime/rooms';
import { subscribeRoomState } from '@/lib/realtime/channel';
import { getServerActor } from '@/lib/realtime/clientActor';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import { supabase } from '@/lib/supabase/client';

type EndReason = 'timeout' | 'insufficient_players';

interface PlayerState {
  userId: string;
  nickname: string;
  isReady: boolean;
  isSpectator: boolean;
}

interface GameConfig {
  durationSec: number;
  cooldownMs: number;
  hostOnlyPass: boolean;
  allowSelfPass: boolean;
  antiRepeatWindow: number;
  lateJoinPolicy: 'spectator';
}

interface GameHistory {
  roundId: number;
  winnerUserId: string | null;
  endedAtMs: number;
  reason?: EndReason;
}

interface GameState {
  status: 'idle' | 'running' | 'ended';
  roundId: number;
  startedAtMs: number | null;
  endsAtMs: number | null;
  holderUserId: string | null;
  lastPassAtMs: number | null;
  lastHolders: string[];
  history: GameHistory[];
  winnerUserId: string | null;
  reason: EndReason | null;
  config: GameConfig;
  processedActionIds: string[];
}

interface HotPotatoRoomState {
  revision: number;
  lastActor: string | null;
  hostId: string;
  players: PlayerState[];
  game: GameState;
}

interface UiError {
  code: string;
  message: string;
}

type MutateResult = {
  nextState: HotPotatoRoomState;
  error?: UiError;
};

const MIN_PLAYERS = 2;

const DEFAULT_CONFIG: GameConfig = {
  durationSec: 30,
  cooldownMs: 800,
  hostOnlyPass: false,
  allowSelfPass: false,
  antiRepeatWindow: 2,
  lateJoinPolicy: 'spectator',
};

const ERROR_MESSAGES: Record<string, string> = {
  ERR_MIN_PLAYERS: '2인 이상 들어와야 시작할 수 있습니다.',
  ERR_NOT_HOST: '진행자만 시작할 수 있습니다.',
  ERR_NOT_RUNNING: '게임이 진행 중이 아닙니다.',
  ERR_ROUND_MISMATCH: '라운드가 변경되었습니다. 최신 화면으로 다시 시도하세요.',
  ERR_COOLDOWN: '잠시 후 다시 시도하세요.',
  ERR_ALREADY_ENDED: '이미 종료된 라운드입니다.',
};

const buildInitialRoomState = (
  hostId: string,
  nickname = createNickname(hostId),
  isReady = true
): HotPotatoRoomState => ({
  revision: 0,
  lastActor: hostId,
  hostId,
  players: [
    {
      userId: hostId,
      nickname,
      isReady,
      isSpectator: false,
    },
  ],
  game: {
    status: 'idle',
    roundId: 0,
    startedAtMs: null,
    endsAtMs: null,
    holderUserId: null,
    lastPassAtMs: null,
    lastHolders: [],
    history: [],
    winnerUserId: null,
    reason: null,
    config: DEFAULT_CONFIG,
    processedActionIds: [],
  },
});

function HotPotatoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');

  const [clientActor, setClientActor] = useState('guest');
  const [roomState, setRoomState] = useState<HotPotatoRoomState>(() => buildInitialRoomState('guest'));
  const roomStateRef = useRef<HotPotatoRoomState>(buildInitialRoomState('guest'));
  const [roomInfo, setRoomInfo] = useState<{ name: string | null; maxCapacity: number | null }>({
    name: null,
    maxCapacity: null,
  });
  const [isRoomHydrated, setIsRoomHydrated] = useState(() => !roomId);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [connectedActors, setConnectedActors] = useState<string[]>([]);
  const [errorBanner, setErrorBanner] = useState<UiError | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [hasEntered, setHasEntered] = useState(false);
  const nicknameInputRef = useRef('');

  const sendStateRef = useRef<((state: HotPotatoRoomState) => void) | null>(null);
  const actionSeqRef = useRef(0);

  const applyRoomState = useCallback((nextState: HotPotatoRoomState) => {
    roomStateRef.current = nextState;
    setRoomState(nextState);
  }, []);

  const pushRoomState = useCallback(
    async (mutator: (current: HotPotatoRoomState) => MutateResult) => {
      if (!roomId) return false;

      const applyOne = async (baseState: HotPotatoRoomState) => {
        const result = mutator(baseState);
        if (result.error) {
          setErrorBanner(result.error);
          return false;
        }

        const optimisticState: HotPotatoRoomState = {
          ...result.nextState,
          revision: baseState.revision + 1,
          lastActor: clientActor,
        };

        applyRoomState(optimisticState);
        sendStateRef.current?.(optimisticState);

        try {
          await updateRoomState(roomId, optimisticState, baseState.revision);
          return true;
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('Realtime conflict')) {
            applyRoomState(baseState);
            return false;
          }

          const latest = await getRoom<HotPotatoRoomState>(roomId);
          if (!latest) {
            applyRoomState(baseState);
            return false;
          }

          const latestState = latest.game_state;
          applyRoomState(latestState);

          const retryResult = mutator(latestState);
          if (retryResult.error) {
            setErrorBanner(retryResult.error);
            return false;
          }

          const retryState: HotPotatoRoomState = {
            ...retryResult.nextState,
            revision: latestState.revision + 1,
            lastActor: clientActor,
          };

          applyRoomState(retryState);
          sendStateRef.current?.(retryState);

          try {
            await updateRoomState(roomId, retryState, latestState.revision);
            return true;
          } catch {
            applyRoomState(latestState);
            return false;
          }
        }
      };

      return applyOne(roomStateRef.current);
    },
    [applyRoomState, clientActor, roomId]
  );

  const connectedSet = useMemo(() => {
    if (connectedActors.length === 0) return null;
    return new Set(connectedActors);
  }, [connectedActors]);

  const effectivePlayers = useMemo(
    () => roomState.players.filter(player => !player.isSpectator && isPlayerConnected(player.userId, connectedSet)),
    [connectedSet, roomState.players]
  );

  const holderPlayer = useMemo(
    () => roomState.players.find(player => player.userId === roomState.game.holderUserId) ?? null,
    [roomState.game.holderUserId, roomState.players]
  );

  const winnerPlayer = useMemo(
    () => roomState.players.find(player => player.userId === roomState.game.winnerUserId) ?? null,
    [roomState.game.winnerUserId, roomState.players]
  );

  const canStart = useMemo(() => {
    if (clientActor !== roomState.hostId) {
      return { ok: false, message: ERROR_MESSAGES.ERR_NOT_HOST };
    }

    if (effectivePlayers.length < MIN_PLAYERS) {
      return { ok: false, message: ERROR_MESSAGES.ERR_MIN_PLAYERS };
    }

    return { ok: true, message: '' };
  }, [clientActor, effectivePlayers.length, roomState.hostId]);

  const cooldownRemainingMs = useMemo(() => {
    const game = roomState.game;
    if (game.status !== 'running' || !game.lastPassAtMs) return 0;
    return Math.max(0, game.lastPassAtMs + game.config.cooldownMs - nowMs);
  }, [nowMs, roomState.game]);

  const timerRemainingMs = useMemo(() => {
    if (roomState.game.status !== 'running' || !roomState.game.endsAtMs) return 0;
    return Math.max(0, roomState.game.endsAtMs - nowMs);
  }, [nowMs, roomState.game]);

  const canPass = useMemo(() => {
    const game = roomState.game;
    if (game.status !== 'running') return false;
    if (clientActor === 'guest') return false;
    if (game.config.hostOnlyPass && clientActor !== roomState.hostId) return false;
    if (cooldownRemainingMs > 0) return false;
    return true;
  }, [clientActor, cooldownRemainingMs, roomState.game, roomState.hostId]);

  const handleCreateRoom = async () => {
    const resolvedActor = clientActor === 'guest' ? await getServerActor() : clientActor;
    const trimmedNickname = nicknameInput.trim();
    const initialNickname = trimmedNickname || createNickname(resolvedActor);
    const localReadyState = roomStateRef.current.players[0]?.isReady ?? true;

    if (clientActor === 'guest' && resolvedActor !== 'guest') {
      setClientActor(resolvedActor);
      setNicknameInput(initialNickname);
    }

    const initial = buildInitialRoomState(resolvedActor, initialNickname, localReadyState);
    const room = await createRoom('hot_potato', initial, { name: '폭탄 돌리기 방' });
    router.push(`/hot-potato?roomId=${room.id}`);
  };

  const handleToggleReady = async () => {
    if (!roomId) {
      const localPlayer = roomStateRef.current.players[0];
      const localActor = clientActor === 'guest' ? roomStateRef.current.hostId : clientActor;
      const localNickname = localPlayer?.nickname || nicknameInput.trim() || createNickname(localActor);
      const nextReady = !(localPlayer?.isReady ?? true);

      applyRoomState(buildInitialRoomState(localActor, localNickname, nextReady));
      return;
    }

    setErrorBanner(null);

    await pushRoomState(current => ({
      nextState: {
        ...current,
        players: current.players.map(player =>
          player.userId === clientActor ? { ...player, isReady: !player.isReady } : player
        ),
      },
    }));
  };

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) return;

    if (!roomId) {
      const localActor = clientActor === 'guest' ? roomStateRef.current.hostId : clientActor;
      const localReady = roomStateRef.current.players[0]?.isReady ?? true;
      applyRoomState(buildInitialRoomState(localActor, trimmed, localReady));
      setNicknameInput(trimmed);
      return;
    }

    await pushRoomState(current => {
      const uniqueNickname = toUniqueNickname(trimmed, current.players, clientActor);

      return {
        nextState: {
          ...current,
          players: current.players.map(player =>
            player.userId === clientActor ? { ...player, nickname: uniqueNickname } : player
          ),
        },
      };
    });

    setNicknameInput(trimmed);
  };

  const handleStartGame = async () => {
    if (!roomId) return;
    setErrorBanner(null);

    await pushRoomState(current => {
      if (clientActor !== current.hostId) {
        return errorResult('ERR_NOT_HOST', current);
      }

      const participants = current.players.filter(
        player => !player.isSpectator && isPlayerConnected(player.userId, connectedSet)
      );

      if (participants.length < MIN_PLAYERS) {
        return errorResult('ERR_MIN_PLAYERS', current);
      }

      const now = Date.now();
      const roundId = current.game.roundId + 1;
      const holder = participants[Math.floor(Math.random() * participants.length)]?.userId ?? participants[0].userId;

      return {
        nextState: {
          ...current,
          players: current.players.map(player => {
            if (!isPlayerConnected(player.userId, connectedSet)) return player;
            return { ...player, isSpectator: false };
          }),
          game: {
            ...current.game,
            status: 'running',
            roundId,
            startedAtMs: now,
            endsAtMs: now + current.game.config.durationSec * 1000,
            holderUserId: holder,
            winnerUserId: null,
            reason: null,
            lastPassAtMs: 0,
            lastHolders: [holder],
            processedActionIds: [],
          },
        },
      };
    });
  };

  const handlePass = async () => {
    if (!roomId) return;
    setErrorBanner(null);

    const requestedRoundId = roomStateRef.current.game.roundId;
    const clientActionId = `${clientActor}:${Date.now()}:${actionSeqRef.current++}`;

    await pushRoomState(current => {
      const game = current.game;
      const now = Date.now();

      if (game.status !== 'running') {
        return errorResult('ERR_NOT_RUNNING', current);
      }

      if (!game.endsAtMs || now >= game.endsAtMs) {
        return errorResult('ERR_ALREADY_ENDED', current);
      }

      if (game.config.hostOnlyPass && clientActor !== current.hostId) {
        return errorResult('ERR_NOT_HOST', current);
      }

      if (game.processedActionIds.includes(clientActionId)) {
        return { nextState: current };
      }

      if (game.lastPassAtMs && now - game.lastPassAtMs < game.config.cooldownMs) {
        return errorResult('ERR_COOLDOWN', current);
      }

      const participants = current.players
        .filter(player => !player.isSpectator && isPlayerConnected(player.userId, connectedSet))
        .map(player => player.userId);

      if (participants.length < MIN_PLAYERS) {
        return {
          nextState: endRunningGame(current, 'insufficient_players', now),
        };
      }

      if (game.roundId !== requestedRoundId) {
        return errorResult('ERR_ROUND_MISMATCH', current);
      }

      let candidates = participants;
      if (!game.config.allowSelfPass && game.holderUserId) {
        candidates = candidates.filter(userId => userId !== game.holderUserId);
      }

      const antiRepeatPool = game.lastHolders.slice(-game.config.antiRepeatWindow);
      const antiRepeatCandidates = candidates.filter(userId => !antiRepeatPool.includes(userId));
      const finalCandidates = antiRepeatCandidates.length > 0 ? antiRepeatCandidates : candidates;

      if (finalCandidates.length === 0) {
        return { nextState: current };
      }

      const nextHolder = finalCandidates[Math.floor(Math.random() * finalCandidates.length)] ?? finalCandidates[0];

      return {
        nextState: {
          ...current,
          game: {
            ...game,
            holderUserId: nextHolder,
            lastPassAtMs: now,
            lastHolders: [...game.lastHolders, nextHolder].slice(-20),
            processedActionIds: [...game.processedActionIds, clientActionId].slice(-100),
          },
        },
      };
    });
  };

  const handleReset = async () => {
    if (!roomId) return;
    setErrorBanner(null);

    await pushRoomState(current => {
      if (clientActor !== current.hostId) {
        return errorResult('ERR_NOT_HOST', current);
      }

      return {
        nextState: {
          ...current,
          players: current.players.map(player => ({ ...player, isSpectator: false })),
          game: {
            ...current.game,
            status: 'idle',
            startedAtMs: null,
            endsAtMs: null,
            holderUserId: null,
            lastPassAtMs: null,
            lastHolders: [],
            winnerUserId: null,
            reason: null,
            processedActionIds: [],
          },
        },
      };
    });
  };

  useEffect(() => {
    let mounted = true;

    getServerActor().then(actor => {
      if (!mounted) return;
      setClientActor(actor);
      setNicknameInput(previous => {
        const trimmed = previous.trim();
        if (trimmed && trimmed !== createNickname('guest')) {
          return previous;
        }

        return createNickname(actor);
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    nicknameInputRef.current = nicknameInput;
  }, [nicknameInput]);

  useEffect(() => {
    setIsRoomHydrated(!roomId);
  }, [roomId]);

  useEffect(() => {
    if (roomId || clientActor === 'guest') return;

    const currentHostId = roomStateRef.current.hostId;
    const currentNickname = roomStateRef.current.players[0]?.nickname ?? '';
    const currentReady = roomStateRef.current.players[0]?.isReady ?? true;
    const preservedNickname =
      currentNickname && currentNickname !== createNickname(currentHostId)
        ? currentNickname
        : nicknameInputRef.current.trim() || createNickname(clientActor);

    applyRoomState(buildInitialRoomState(clientActor, preservedNickname, currentReady));
  }, [applyRoomState, clientActor, roomId]);

  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    getRoom<HotPotatoRoomState>(roomId).then(room => {
      if (!mounted) return;
      if (room) {
        applyRoomState(room.game_state);
        setRoomInfo({ name: room.name, maxCapacity: room.max_capacity });
      }
      setIsRoomHydrated(true);
    });

    const { unsubscribe, sendState } = subscribeRoomState<HotPotatoRoomState>({
      roomId,
      onState: state => {
        if (!mounted) return;
        applyRoomState(state);
        setIsRoomHydrated(true);
      },
    });

    sendStateRef.current = sendState;

    return () => {
      mounted = false;
      unsubscribe();
      sendStateRef.current = null;
    };
  }, [applyRoomState, roomId]);

  useEffect(() => {
    if (!roomId || !hasSupabaseConfig()) return;

    let mounted = true;
    const channel = supabase.channel(`presence:hot-potato:${roomId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!mounted) return;
        const state = channel.presenceState();
        const actors = new Set<string>();

        Object.values(state).forEach(presences => {
          const first = (presences as Array<{ actor?: string }>)[0];
          if (first?.actor) {
            actors.add(first.actor);
          }
        });

        setConnectedActors(Array.from(actors));
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ actor: clientActor });
        }
      });

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [clientActor, roomId]);

  useEffect(() => {
    if (!roomId || !isRoomHydrated || !clientActor || clientActor === 'guest') return;

    const player = roomStateRef.current.players.find(item => item.userId === clientActor);
    const hasGuestPlaceholder = roomStateRef.current.players.some(item => item.userId === 'guest');
    if (player && !hasGuestPlaceholder) return;

    void pushRoomState(current => {
      const playersWithoutGuest = current.players.filter(item => item.userId !== 'guest');
      const exists = playersWithoutGuest.some(item => item.userId === clientActor);
      const normalizedHostId = current.hostId === 'guest' ? clientActor : current.hostId;

      if (exists) {
        if (playersWithoutGuest.length === current.players.length && normalizedHostId === current.hostId) {
          return { nextState: current };
        }

        return {
          nextState: {
            ...current,
            hostId: normalizedHostId,
            players: playersWithoutGuest,
          },
        };
      }

      const isSpectator = current.game.status === 'running' && current.game.config.lateJoinPolicy === 'spectator';

      return {
        nextState: {
          ...current,
          hostId: normalizedHostId,
          players: [
            ...playersWithoutGuest,
            {
              userId: clientActor,
              nickname: toUniqueNickname(createNickname(clientActor), playersWithoutGuest, clientActor),
              isReady: false,
              isSpectator,
            },
          ],
        },
      };
    });
  }, [clientActor, isRoomHydrated, pushRoomState, roomId]);

  useEffect(() => {
    if (roomState.game.status === 'running') return;

    const currentPlayer = roomState.players.find(player => player.userId === clientActor);
    if (!currentPlayer) return;

    setNicknameInput(previous => {
      if (previous.trim().length > 0 && previous !== createNickname(clientActor)) {
        return previous;
      }

      return currentPlayer.nickname;
    });
  }, [clientActor, roomState.game.status, roomState.players]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 100);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    if (roomState.game.status !== 'running') return;

    if (effectivePlayers.length < MIN_PLAYERS) {
      void pushRoomState(current => {
        if (current.game.status !== 'running') return { nextState: current };
        return {
          nextState: endRunningGame(current, 'insufficient_players', Date.now()),
        };
      });
      return;
    }

    const endsAtMs = roomState.game.endsAtMs;
    if (!endsAtMs || nowMs < endsAtMs) return;

    void pushRoomState(current => {
      if (current.game.status !== 'running') return { nextState: current };
      if (!current.game.endsAtMs || Date.now() < current.game.endsAtMs) return { nextState: current };

      return {
        nextState: endRunningGame(current, 'timeout', Date.now()),
      };
    });
  }, [effectivePlayers.length, nowMs, pushRoomState, roomId, roomState.game.endsAtMs, roomState.game.status]);

  const statusText =
    roomState.game.status === 'idle' ? '대기 중' : roomState.game.status === 'running' ? '진행 중' : '종료됨';

  const progress =
    roomState.game.status === 'running' && roomState.game.startedAtMs && roomState.game.endsAtMs
      ? Math.max(0, Math.min(1, timerRemainingMs / (roomState.game.endsAtMs - roomState.game.startedAtMs)))
      : 0;
  const showIntro = !roomId && !hasEntered && roomState.game.status === 'idle';

  return (
    <div className="relative px-4 pb-28 pt-10">
      {showIntro && (
        <section className="relative mx-auto flex max-w-xl flex-col items-center justify-center text-center">
          <UniqueText Tag="h1" font="sans" size="lg" className="relative mt-4 text-center text-chocolate">
            폭탄
            <br />
            <span className="text-[3.625rem] leading-[103.8%]">돌리기</span>
          </UniqueText>
          <p className="relative mt-4 max-w-[18rem] text-sm leading-6 text-chocolate/70">
            타이머가 끝나기 전에 폭탄을 넘기고 마지막까지 살아남는 사람을 가려보세요!
          </p>
          <div className="relative mt-8 w-full max-w-[20rem]">
            <Image
              src="/hot-potato/bomb.png"
              alt="폭탄 돌리기 메인 일러스트"
              width={320}
              height={320}
              priority
              className="relative mx-auto w-full max-w-[16rem] animate-[float_4.2s_ease-in-out_infinite]"
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
      )}

      {!showIntro && (
        <div className="mx-auto max-w-xl rounded-2xl border border-chocolate/20 bg-white p-5 shadow-sm">
          <UniqueText Tag="h1" font="sans" size="lg" className="text-center text-chocolate">
            폭탄
            <br />
            <span className="text-[3.625rem] leading-[103.8%]">돌리기</span>
          </UniqueText>
          <p className="mt-2 text-center text-sm text-gray-500">상태: {statusText}</p>

          {!roomId && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              방을 만든 뒤 링크를 공유해 2인 이상 모이면 시작할 수 있습니다.
            </p>
          )}

          {errorBanner && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorBanner.message}
            </div>
          )}

          <section className="mt-5 rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">참가자</h2>
              <span className="text-xs text-gray-500">{effectivePlayers.length}명 참여 중</span>
            </div>

            <ul className="mt-3 space-y-2">
              {roomState.players.map(player => (
                <li
                  key={player.userId}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {player.nickname}
                      {player.userId === roomState.hostId ? ' (Host)' : ''}
                      {player.userId === clientActor ? ' (나)' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {player.isSpectator ? '관전' : player.isReady ? '준비 완료' : '준비 전'}
                    </p>
                  </div>
                  {player.userId === clientActor && roomState.game.status !== 'running' && (
                    <MainButton variant="outlined" color="chocolate" onClick={handleToggleReady}>
                      {player.isReady ? '준비 해제' : '준비'}
                    </MainButton>
                  )}
                </li>
              ))}
            </ul>

            {roomState.game.status !== 'running' && (
              <div className="mt-4 flex gap-2">
                <input
                  value={nicknameInput}
                  onChange={event => setNicknameInput(event.target.value)}
                  placeholder="닉네임 수정"
                  className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-chocolate"
                />
                <MainButton
                  variant="outlined"
                  color="chocolate"
                  onClick={handleSaveNickname}
                  className="flex-shrink-0"
                  fullWidth={false}
                >
                  닉네임 저장
                </MainButton>
              </div>
            )}
            {roomState.game.status !== 'running' && (
              <div className="mt-4">
                <MainButton variant="contained" color="chocolate" disabled={!canStart.ok} onClick={handleStartGame}>
                  게임 시작
                </MainButton>
                {!canStart.ok && <p className="mt-2 text-xs text-amber-700">{canStart.message}</p>}
              </div>
            )}
          </section>

          {roomState.game.status === 'running' && (
            <section className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="mx-auto h-56 w-56">
                <Image
                  src="/hot-potato/bomb.png"
                  alt="Hot potato bomb character"
                  width={320}
                  height={320}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <p className="mt-2 text-center text-lg font-semibold text-gray-900">
                현재 소유자: {holderPlayer?.nickname ?? '알 수 없음'}
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>남은 시간</span>
                  <span>{(timerRemainingMs / 1000).toFixed(1)}s</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full bg-chocolate transition-[width] duration-100"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <MainButton variant="contained" color="chocolate" disabled={!canPass} onClick={handlePass}>
                  다음 사람
                </MainButton>
                {cooldownRemainingMs > 0 && (
                  <p className="text-sm text-gray-600">
                    잠시 후 다시 시도하세요 ({(cooldownRemainingMs / 1000).toFixed(1)}s)
                  </p>
                )}
              </div>
            </section>
          )}

          {roomState.game.status === 'ended' && (
            <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-center text-2xl font-bold text-emerald-700">
                당첨: {winnerPlayer?.nickname ?? '알 수 없음'} 🎉
              </p>
              {roomState.game.reason === 'insufficient_players' && (
                <>
                  <p className="mt-2 text-center text-sm text-red-700">인원이 부족해 게임이 종료되었습니다.</p>
                  <p className="text-center text-xs text-gray-600">다시하기는 2인 이상일 때 가능합니다.</p>
                </>
              )}
              {roomState.game.reason === 'timeout' && (
                <p className="mt-2 text-center text-sm text-gray-700">타이머 종료로 라운드가 끝났습니다.</p>
              )}

              {clientActor === roomState.hostId && (
                <div className="mt-4">
                  <MainButton variant="contained" color="chocolate" onClick={handleReset}>
                    Replay / Reset
                  </MainButton>
                </div>
              )}
            </section>
          )}
        </div>
      )}
      <RoomSharePanel
        gameType="hot_potato"
        roomId={roomId}
        localActor={clientActor}
        hasConfig={hasSupabaseConfig()}
        preferFloatingEntry
        onCreateRoom={handleCreateRoom}
        lastActor={roomState.lastActor}
        roomName={roomInfo.name}
        maxCapacity={roomInfo.maxCapacity}
      />
    </div>
  );
}

export default function HotPotatoPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen" />}>
      <HotPotatoPageContent />
    </Suspense>
  );
}

function createNickname(actor: string) {
  const suffix = actor.replace('anon-', '').slice(-4);
  return `플레이어-${suffix || actor.slice(-4)}`;
}

function toUniqueNickname(desired: string, players: PlayerState[], selfUserId: string) {
  const base = desired.trim();
  if (!base) return desired;

  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const occupied = new Set(
    players.filter(player => player.userId !== selfUserId).map(player => normalize(player.nickname))
  );

  if (!occupied.has(normalize(base))) {
    return base;
  }

  let index = 2;
  while (occupied.has(normalize(`${base} (${index})`))) {
    index += 1;
  }

  return `${base} (${index})`;
}

function isPlayerConnected(userId: string, connectedSet: Set<string> | null) {
  if (!connectedSet) return true;
  return connectedSet.has(userId);
}

function errorResult(code: keyof typeof ERROR_MESSAGES, current: HotPotatoRoomState): MutateResult {
  return {
    nextState: current,
    error: {
      code,
      message: ERROR_MESSAGES[code],
    },
  };
}

function endRunningGame(current: HotPotatoRoomState, reason: EndReason, endedAtMs: number): HotPotatoRoomState {
  const winnerUserId = current.game.holderUserId;

  return {
    ...current,
    game: {
      ...current.game,
      status: 'ended',
      winnerUserId,
      reason,
      endsAtMs: endedAtMs,
      history: [
        ...current.game.history,
        {
          roundId: current.game.roundId,
          winnerUserId,
          endedAtMs,
          reason,
        },
      ].slice(-20),
    },
  };
}
