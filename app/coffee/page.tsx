'use client';

import React, { useCallback, useEffect, useReducer } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Loading from '@/domains/coffee/Loading';
import Order from '@/domains/coffee/Order';
import Shuffle from '@/domains/coffee/Shuffle';
import Start from '@/domains/coffee/Start';

import PlayerButton from '@/domains/coffee/PlayerButton';
import AudioPlayer from '@/components/AudioPlayer';
import useStep from '@/lib/hooks/useStep';
import usePlayAudio from '@/lib/hooks/usePlayAudio';
import { coffeeReducer, CoffeeActionType, soundReducer, SoundActionType } from '@/lib/reducer/coffee';
import { CoffeeContext, initialCoffeeState, initialallMuteState } from '@/lib/context/coffee';
import prevBtnIcon from '@/public/button/button_prev.svg';
import { BGM_URL } from '@/lib/constants/coffee';
import { createRoom, getRoom, updateRoomState } from '@/lib/realtime/rooms';
import { subscribeRoomState } from '@/lib/realtime/channel';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import RoomSharePanel from '@/components/realtime/RoomSharePanel';
import { getLottery } from '@/lib/utils/random';
import { getServerActor } from '@/lib/realtime/clientActor';

interface CoffeeGameState {
  step: number;
  orderState: typeof initialCoffeeState;
  result: string | null;
  revision: number;
  lastActor: string | null;
  selections: Record<string, number | null>; // actorId -> cardIndex
}

export default function Coffee() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId = searchParams.get('roomId');
  const isRealtimeEnabled = Boolean(roomId);

  const [step, Container, handleStep] = useStep(0);
  const [clientActor, setClientActor] = React.useState('guest');
  const [orderState, orderDispatch] = useReducer(coffeeReducer, initialCoffeeState);
  const [allMuteState, soundDispatch] = useReducer(soundReducer, initialallMuteState);
  const [realtimeState, setRealtimeState] = React.useState<CoffeeGameState>({
    step: 0,
    orderState: initialCoffeeState,
    result: null,
    revision: 0,
    lastActor: null,
    selections: {},
  });
  const [roomInfo, setRoomInfo] = React.useState<{ title: string | null; maxPlayers: number | null }>({
    title: null,
    maxPlayers: null,
  });
  const [activeSelections, setActiveSelections] = React.useState<
    Record<string, { actor: string; cardIndex: number | null }>
  >({});

  const { playerRef, playSound } = usePlayAudio();
  const sendStateRef = React.useRef<((state: CoffeeGameState) => void) | null>(null);
  const presenceChannelRef = React.useRef<any>(null);

  const currentStep = isRealtimeEnabled ? realtimeState.step : step;
  const currentOrderState = isRealtimeEnabled ? realtimeState.orderState : orderState;
  const isMainStep = currentStep === 0;

  const pushRealtimeState = useCallback(
    async (nextState: Omit<CoffeeGameState, 'revision' | 'lastActor' | 'selections'>) => {
      if (!roomId) return;

      const previousState = realtimeState;
      const optimisticState: CoffeeGameState = {
        ...nextState,
        selections: previousState.selections,
        revision: previousState.revision + 1,
        lastActor: clientActor,
      };

      setRealtimeState(optimisticState);
      sendStateRef.current?.(optimisticState);

      try {
        await updateRoomState(roomId, optimisticState, previousState.revision);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Realtime conflict')) {
          const latest = await getRoom<CoffeeGameState>(roomId);
          if (latest) {
            setRealtimeState(latest.game_state);
          } else {
            setRealtimeState(previousState);
          }
          return;
        }
        setRealtimeState(previousState);
        throw error;
      }
    },
    [clientActor, realtimeState, roomId]
  );

  const handleCardSelect = useCallback(
    (cardIndex: number | null) => {
      if (!isRealtimeEnabled || !presenceChannelRef.current) return;

      // Presence로 즉시 전파 (Google Docs 스타일 하이라이트용)
      void presenceChannelRef.current.track({
        actor: clientActor,
        cardIndex: cardIndex,
      });
    },
    [clientActor, isRealtimeEnabled]
  );

  const handleOrder = (type: CoffeeActionType) => {
    if (isRealtimeEnabled) {
      const nextOrderState = coffeeReducer(currentOrderState, { type });
      void pushRealtimeState({
        step: currentStep,
        orderState: nextOrderState,
        result: null,
      });
      return;
    }

    orderDispatch({ type });
  };

  const handleStepWithSync = (type: 'next' | 'prev') => {
    if (isRealtimeEnabled) {
      const nextStep = type === 'next' ? currentStep + 1 : Math.max(0, currentStep - 1);
      void pushRealtimeState({
        step: nextStep,
        orderState: currentOrderState,
        result: type === 'prev' ? null : realtimeState.result,
      });
      return;
    }

    handleStep(type);
  };

  const onSoundToggle = () => {
    const type = allMuteState.isAllMuted ? 'UNMUTE_SOUND' : 'MUTE_SOUND';
    handleAllMute(type);
  };

  const handleAllMute = (type: SoundActionType) => {
    soundDispatch({ type });
  };

  const renderPrevBtn = currentStep !== 0 && (
    <Image
      className="fixed z-[var(--nav-z-index)] top-16 left-2 cursor-pointer"
      src={prevBtnIcon}
      alt="이전 버튼"
      width={32}
      height={32}
      onClick={() => handleStepWithSync('prev')}
    />
  );

  const handleCreateRoom = async () => {
    const title = prompt('방 이름을 입력해주세요 (공백 시 기본값)', '커피내기 한판!');
    if (title === null) return; // 취소

    const maxPlayersStr = prompt('최대 인원수를 설정해주세요 (기본 10)', '10');
    if (maxPlayersStr === null) return;

    const maxPlayers = parseInt(maxPlayersStr, 10) || 10;

    const state: CoffeeGameState = {
      step: 0,
      orderState: initialCoffeeState,
      result: null,
      revision: 0,
      lastActor: clientActor,
    };
    const room = await createRoom('coffee', state, { title, maxPlayers });
    router.push(`/coffee?roomId=${room.id}`);
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

    getRoom<CoffeeGameState>(roomId).then(room => {
      if (!mounted || !room) return;
      setRealtimeState(room.game_state);
      setRoomInfo({ title: room.title, maxPlayers: room.max_players });
    });

    const { unsubscribe, sendState } = subscribeRoomState<CoffeeGameState>({
      roomId,
      onState: state => {
        if (!mounted) return;
        setRealtimeState(state);
      },
    });

    sendStateRef.current = sendState;

    return () => {
      mounted = false;
      unsubscribe();
      sendStateRef.current = null;
    };
  }, [roomId]);

  useEffect(() => {
    if (!isRealtimeEnabled) return;
    if (currentStep !== 3 || realtimeState.result) return;

    const result = getLottery(currentOrderState.total, currentOrderState.boom).join(',');
    void pushRealtimeState({
      step: currentStep,
      orderState: currentOrderState,
      result,
    });
  }, [currentStep, currentOrderState, isRealtimeEnabled, pushRealtimeState, realtimeState.result]);

  useEffect(() => {
    playSound(playerRef?.current?.audio?.current);
  }, [allMuteState.isAllMuted, playSound, playerRef]);

  // useEffect(() => {
  //   const button = document.createElement('button');
  //   document.body.appendChild(button);
  //   button.addEventListener('click', () => {
  //     button.remove();
  //   }
  // }, []);

  useEffect(() => {
    if (!roomId || !isRealtimeEnabled) return;

    let mounted = true;

    const channel = supabase.channel(`presence:${roomId}`);
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!mounted) return;
        const state = channel.presenceState();
        const simplified: Record<string, { actor: string; cardIndex: number | null }> = {};

        Object.entries(state).forEach(([key, presences]) => {
          const first = presences[0] as any;
          if (first) {
            simplified[key] = {
              actor: first.actor,
              cardIndex: first.cardIndex ?? null,
            };
          }
        });

        setActiveSelections(simplified);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ actor: clientActor, cardIndex: null });
        }
      });

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [roomId, isRealtimeEnabled, clientActor]);

  return (
    <div className="relative">
      <RoomSharePanel
        gameType="coffee"
        roomId={roomId}
        localActor={clientActor}
        hasConfig={hasSupabaseConfig()}
        onCreateRoom={handleCreateRoom}
        lastActor={isRealtimeEnabled ? realtimeState.lastActor : clientActor}
        roomTitle={roomInfo.title}
        maxPlayers={roomInfo.maxPlayers}
      />
      {renderPrevBtn}
      <CoffeeContext.Provider
        value={{
          orderState: currentOrderState,
          allMuteState,
          handleOrder,
          handleAllMute,
          activeSelections,
          handleCardSelect,
          clientActor,
        }}
      >
        {!isMainStep && <AudioPlayer volume={0.4} ref={playerRef} src={BGM_URL} muted={allMuteState.isAllMuted} />}
        {!isMainStep && <PlayerButton onSoundToggle={onSoundToggle} muted={allMuteState.isAllMuted} />}
        <Container curStep={currentStep}>
          <Start handleStep={handleStepWithSync} />
          <Order state={currentOrderState} handleStep={handleStepWithSync} />
          <Shuffle cnt={currentOrderState.total} handleStep={handleStepWithSync} />
          <Loading
            resultValue={isRealtimeEnabled ? realtimeState.result : undefined}
            roomId={roomId}
            isRealtimeEnabled={isRealtimeEnabled}
          />
        </Container>
      </CoffeeContext.Provider>
    </div>
  );
}
