'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useRoom, createRoom, roomErrorMessage } from '@/src/entities/room';

import { getServerActor } from '@/src/entities/room';
import { useSound } from '@/lib/context/sound';
export type EndReason = 'timeout' | 'insufficient_players';

export interface PlayerState {
  userId: string;
  nickname: string;
  isReady: boolean;
  isSpectator: boolean;
}

export interface GameConfig {
  durationSec: number;
  cooldownMs: number;
  hostOnlyPass: boolean;
  allowSelfPass: boolean;
  antiRepeatWindow: number;
  lateJoinPolicy: 'spectator';
}

export interface GameHistory {
  roundId: number;
  winnerUserId: string | null;
  endedAtMs: number;
  reason?: EndReason;
}

export interface GameState {
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

export interface HotPotatoRoomState {
  revision: number;
  lastActor: string | null;
  hostId: string;
  players: PlayerState[];
  game: GameState;
}

export interface UiError {
  code: string;
  message: string;
}

export type MutateResult = {
  nextState: HotPotatoRoomState;
  error?: UiError;
};

export const MIN_PLAYERS = 2;

export const DURATION_OPTIONS = [15, 30, 60] as const;

export const DEFAULT_CONFIG: GameConfig = {
  durationSec: 30,
  cooldownMs: 800,
  hostOnlyPass: false,
  allowSelfPass: false,
  antiRepeatWindow: 2,
  lateJoinPolicy: 'spectator',
};

export const ERROR_MESSAGES: Record<string, string> = {
  ERR_MIN_PLAYERS: '2인 이상 들어와야 시작할 수 있습니다.',
  ERR_NOT_HOST: '진행자만 시작할 수 있습니다.',
  ERR_NOT_RUNNING: '게임이 진행 중이 아닙니다.',
  ERR_ROUND_MISMATCH: '라운드가 변경되었습니다. 최신 화면으로 다시 시도하세요.',
  ERR_COOLDOWN: '잠시 후 다시 시도하세요.',
  ERR_ALREADY_ENDED: '이미 종료된 라운드입니다.',
  ERR_NOT_READY: '모두 준비되면 시작할 수 있습니다.',
  ERR_ALREADY_RUNNING: '이미 진행 중인 라운드가 있습니다.',
};

export const buildInitialRoomState = (
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

export function useHotPotatoView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const [localActor, setClientActor] = useState('guest');
  const live = useRoom<HotPotatoRoomState>(roomId, 'hot_potato');
  const { isHost, mutate, command } = live;
  const clientActor = roomId ? live.actorId : localActor;
  const [localGameState, setRoomState] = useState<HotPotatoRoomState>(() => buildInitialRoomState('guest'));
  const roomState = roomId ? (live.state ?? localGameState) : localGameState;
  const roomStateRef = useRef<HotPotatoRoomState>(buildInitialRoomState('guest'));
  const roomInfo = { name: live.room?.name ?? null, maxCapacity: live.room?.maxCapacity ?? null };
  const [nowMs, setNowMs] = useState(() => Date.now());
  const connectedActors = useMemo(() => live.members.map(member => member.actorId), [live.members]);
  const [errorBanner, setErrorBanner] = useState<UiError | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [hasEntered, setHasEntered] = useState(false);
  const nicknameInputRef = useRef('');
  const { isMuted } = useSound();
  const boomAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTickSecondRef = useRef<number | null>(null);
  const prevGameStatusRef = useRef<GameState['status']>('idle');
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);
  const applyRoomState = useCallback((nextState: HotPotatoRoomState) => {
    roomStateRef.current = nextState;
    setRoomState(nextState);
  }, []);
  const pushRoomState = useCallback(
    async (mutator: (current: HotPotatoRoomState) => MutateResult) => {
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
  const nicknameByUserId = useMemo(
    () => new Map(roomState.players.map(player => [player.userId, player.nickname])),
    [roomState.players]
  );
  const winnerPlayer = useMemo(
    () => roomState.players.find(player => player.userId === roomState.game.winnerUserId) ?? null,
    [roomState.game.winnerUserId, roomState.players]
  );
  const isEndAuthority = isHost;
  const canStart = useMemo(() => {
    if (clientActor !== roomState.hostId) {
      return { ok: false, message: ERROR_MESSAGES.ERR_NOT_HOST };
    }

    if (effectivePlayers.length < MIN_PLAYERS) {
      return { ok: false, message: ERROR_MESSAGES.ERR_MIN_PLAYERS };
    }

    if (!effectivePlayers.every(player => player.isReady)) {
      return { ok: false, message: ERROR_MESSAGES.ERR_NOT_READY };
    }

    return { ok: true, message: '' };
  }, [clientActor, effectivePlayers, roomState.hostId]);
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
    if (clientActor === 'guest' || game.holderUserId !== clientActor) return false;
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

    const player = roomStateRef.current.players.find(item => item.userId === clientActor);
    await command?.({ kind: 'hot_potato.ready', isReady: !player?.isReady }).catch(() => {});
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

    await command?.({ kind: 'hot_potato.rename', nickname: trimmed.slice(0, 20) }).catch(() => {});

    setNicknameInput(trimmed);
  };
  const handleStartGame = async () => {
    if (!roomId) return;
    setErrorBanner(null);

    await pushRoomState(current => {
      if (clientActor !== current.hostId) {
        return errorResult('ERR_NOT_HOST', current);
      }

      if (current.game.status === 'running') {
        return errorResult('ERR_ALREADY_RUNNING', current);
      }

      const participants = current.players.filter(
        player => !player.isSpectator && isPlayerConnected(player.userId, connectedSet)
      );

      if (participants.length < MIN_PLAYERS) {
        return errorResult('ERR_MIN_PLAYERS', current);
      }

      if (!participants.every(player => player.isReady)) {
        return errorResult('ERR_NOT_READY', current);
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
    await command?.({ kind: 'hot_potato.pass' }).catch(() => {});
  };
  const handleConfigChange = async (patch: Partial<GameConfig>) => {
    if (!roomId) return;
    setErrorBanner(null);

    await pushRoomState(current => {
      if (clientActor !== current.hostId) {
        return errorResult('ERR_NOT_HOST', current);
      }

      if (current.game.status === 'running') {
        return errorResult('ERR_ALREADY_RUNNING', current);
      }

      return {
        nextState: {
          ...current,
          game: {
            ...current.game,
            config: { ...current.game.config, ...patch },
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
    if (!roomId || live.status !== 'connected' || !live.state || clientActor === 'guest') return;
    if (live.state.players.some(player => player.userId === clientActor)) return;
    void command?.({ kind: 'hot_potato.join', nickname: createNickname(clientActor), isReady: false }).catch(() => {});
  }, [roomId, live.status, live.state, command, clientActor]);
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
    const boom = new window.Audio('/sound/boom.m4a');
    boom.preload = 'auto';
    boom.volume = 0.8;
    boomAudioRef.current = boom;

    const tick = new window.Audio('/sound/tick.m4a');
    tick.preload = 'auto';
    tick.volume = 0.55;
    tickAudioRef.current = tick;

    return () => {
      boom.pause();
      tick.pause();
      boomAudioRef.current = null;
      tickAudioRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!isMuted) return;
    boomAudioRef.current?.pause();
    tickAudioRef.current?.pause();
  }, [isMuted]);
  useEffect(() => {
    const prevStatus = prevGameStatusRef.current;
    prevGameStatusRef.current = roomState.game.status;

    if (isMuted) return;
    if (prevStatus === 'ended' || roomState.game.status !== 'ended') return;
    if (roomState.game.reason !== 'timeout') return;

    const boom = boomAudioRef.current;
    if (!boom) return;
    boom.currentTime = 0;
    void boom.play().catch(() => undefined);
  }, [isMuted, roomState.game.reason, roomState.game.status]);
  useEffect(() => {
    if (roomState.game.status !== 'running' || isMuted) {
      lastTickSecondRef.current = null;
      return;
    }
    if (timerRemainingMs <= 0 || timerRemainingMs > 10_000) return;

    const second = Math.ceil(timerRemainingMs / 1000);
    if (lastTickSecondRef.current === second) return;
    lastTickSecondRef.current = second;

    const tick = tickAudioRef.current;
    if (!tick) return;
    tick.currentTime = 0;
    void tick.play().catch(() => undefined);
  }, [isMuted, roomState.game.status, timerRemainingMs]);
  useEffect(() => {
    if (!roomId) return;
    if (roomState.game.status !== 'running') return;
    // 종료 판정은 한 명만 수행해 중복 종료/중복 결과 기록을 막습니다.
    if (!isEndAuthority) return;

    const endsAtMs = roomState.game.endsAtMs;
    if (!endsAtMs || nowMs < endsAtMs) return;

    void pushRoomState(current => {
      if (current.game.status !== 'running') return { nextState: current };
      if (!current.game.endsAtMs || Date.now() < current.game.endsAtMs) return { nextState: current };

      return {
        nextState: endRunningGame(current, 'timeout', Date.now()),
      };
    });
  }, [
    effectivePlayers.length,
    isEndAuthority,
    nowMs,
    pushRoomState,
    roomId,
    roomState.game.endsAtMs,
    roomState.game.status,
  ]);
  useEffect(() => {
    if (
      !roomId ||
      !isHost ||
      live.status !== 'connected' ||
      roomState.game.status !== 'running' ||
      effectivePlayers.length >= MIN_PLAYERS
    )
      return;
    const timer = setTimeout(() => {
      void pushRoomState(current => ({
        nextState:
          current.game.status === 'running' ? endRunningGame(current, 'insufficient_players', Date.now()) : current,
      }));
    }, 10000);
    return () => clearTimeout(timer);
  }, [roomId, isHost, live.status, roomState.game.status, effectivePlayers.length, pushRoomState]);
  const statusText =
    roomState.game.status === 'idle' ? '대기 중' : roomState.game.status === 'running' ? '진행 중' : '종료됨';
  const progress =
    roomState.game.status === 'running' && roomState.game.startedAtMs && roomState.game.endsAtMs
      ? Math.max(0, Math.min(1, timerRemainingMs / (roomState.game.endsAtMs - roomState.game.startedAtMs)))
      : 0;
  const showIntro = !roomId && !hasEntered && roomState.game.status === 'idle';
  return {
    roomId,
    live,
    clientActor,
    roomState,
    roomInfo,
    errorBanner,
    nicknameInput,
    setNicknameInput,
    setHasEntered,
    effectivePlayers,
    holderPlayer,
    nicknameByUserId,
    winnerPlayer,
    canStart,
    cooldownRemainingMs,
    timerRemainingMs,
    canPass,
    handleCreateRoom,
    handleToggleReady,
    handleSaveNickname,
    handleStartGame,
    handlePass,
    handleConfigChange,
    handleReset,
    statusText,
    progress,
    showIntro,
  };
}

function createNickname(actor: string) {
  const suffix = actor.replace('anon-', '').slice(-4);
  return `플레이어-${suffix || actor.slice(-4)}`;
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
