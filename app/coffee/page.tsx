'use client';

import React, { Suspense, useCallback, useEffect, useReducer } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Loading from '@/domains/coffee/Loading';
import Order from '@/domains/coffee/Order';
import Shuffle from '@/domains/coffee/Shuffle';
import Start from '@/domains/coffee/Start';

import useStep from '@/lib/hooks/useStep';
import { coffeeReducer, CoffeeActionType } from '@/lib/reducer/coffee';
import { CoffeeContext, initialCoffeeState } from '@/lib/context/coffee';
import prevBtnIcon from '@/public/button/button_prev.svg';
import { createRoom, getRoom, isRoomExpired, updateRoomState } from '@/lib/realtime/rooms';
import { COFFEE_HOME } from '@/lib/constants/serviceUrls';
import { subscribeRoomState } from '@/lib/realtime/channel';
import { hasRealtimeConfig } from '@/lib/realtime/env';
import { subscribePresence, trackPresence } from '@/lib/realtime/connection';
import RoomSharePanel from '@/components/realtime/RoomSharePanel';
import { getLottery } from '@/lib/utils/random';
import { getServerActor } from '@/lib/realtime/clientActor';
import { useSound } from '@/lib/context/sound';

interface CoffeeGameState {
  step: number;
  orderState: typeof initialCoffeeState;
  result: string | null;
  revision: number;
  lastActor: string | null;
  selections: Record<string, number | null>; // actorId -> cardIndex
}

type RealtimeDraftState = Omit<CoffeeGameState, 'revision' | 'lastActor' | 'selections'>;

const INITIAL_GAME_STATE: CoffeeGameState = {
  step: 0,
  orderState: initialCoffeeState,
  result: null,
  revision: 0,
  lastActor: null,
  selections: {},
};

function CoffeeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 실시간 서버 설정이 없으면 roomId가 붙은 링크로 들어와도 로컬 모드로 동작한다
  const roomId = hasRealtimeConfig() ? searchParams.get('roomId') : null;
  const isRealtimeEnabled = Boolean(roomId);

  const [step, Container, handleStep] = useStep(0);
  const [clientActor, setClientActor] = React.useState('guest');
  const [orderState, orderDispatch] = useReducer(coffeeReducer, initialCoffeeState);
  const [realtimeState, setRealtimeState] = React.useState<CoffeeGameState>(INITIAL_GAME_STATE);
  const realtimeStateRef = React.useRef<CoffeeGameState>(INITIAL_GAME_STATE);
  const [roomInfo, setRoomInfo] = React.useState<{ name: string | null; maxCapacity: number | null }>({
    name: null,
    maxCapacity: null,
  });
  const [activeSelections, setActiveSelections] = React.useState<
    Record<string, { actor: string; cardIndex: number | null }>
  >({});

  const { isMuted, setMuted } = useSound();

  const currentStep = isRealtimeEnabled ? realtimeState.step : step;
  const currentOrderState = isRealtimeEnabled ? realtimeState.orderState : orderState;
  const allMuteState = React.useMemo(() => ({ isAllMuted: isMuted }), [isMuted]);

  const applyRealtimeState = useCallback((nextState: CoffeeGameState) => {
    realtimeStateRef.current = nextState;
    setRealtimeState(nextState);
  }, []);

  const pushRealtimeState = useCallback(
    async (makeNextState: (currentState: CoffeeGameState) => RealtimeDraftState) => {
      if (!roomId) return;

      const previousState = realtimeStateRef.current;
      const optimisticState: CoffeeGameState = {
        ...makeNextState(previousState),
        selections: previousState.selections,
        revision: previousState.revision + 1,
        lastActor: clientActor,
      };

      applyRealtimeState(optimisticState);

      try {
        await updateRoomState(roomId, optimisticState, previousState.revision);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Realtime conflict')) {
          const latest = await getRoom<CoffeeGameState>(roomId);
          if (!latest) {
            applyRealtimeState(previousState);
            return;
          }

          const latestState = latest.game_state;
          const retriedState: CoffeeGameState = {
            ...makeNextState(latestState),
            selections: latestState.selections,
            revision: latestState.revision + 1,
            lastActor: clientActor,
          };

          applyRealtimeState(retriedState);

          try {
            await updateRoomState(roomId, retriedState, latestState.revision);
          } catch (retryError) {
            applyRealtimeState(latestState);
            console.error('Failed to retry realtime state update', retryError);
          }
          return;
        }
        applyRealtimeState(previousState);
        console.error('Failed to update realtime state', error);
      }
    },
    [applyRealtimeState, clientActor, roomId]
  );

  const handleCardSelect = useCallback(
    (cardIndex: number | null) => {
      if (!roomId) return;

      // Presence로 즉시 전파 (Google Docs 스타일 하이라이트용)
      trackPresence(roomId, { actor: clientActor, cardIndex });
    },
    [clientActor, roomId]
  );

  const handleOrder = (type: CoffeeActionType) => {
    if (isRealtimeEnabled) {
      void pushRealtimeState(currentState => ({
        step: currentState.step,
        orderState: coffeeReducer(currentState.orderState, { type }),
        result: null,
      }));
      return;
    }

    orderDispatch({ type });
  };

  const handleStepWithSync = (type: 'next' | 'prev') => {
    if (isRealtimeEnabled) {
      void pushRealtimeState(currentState => ({
        step: type === 'next' ? currentState.step + 1 : Math.max(0, currentState.step - 1),
        orderState: currentState.orderState,
        result: type === 'prev' ? null : currentState.result,
      }));
      return;
    }

    handleStep(type);
  };

  const handleAllMute = React.useCallback(
    (type: 'UNMUTE_SOUND' | 'MUTE_SOUND') => {
      setMuted(type === 'MUTE_SOUND');
    },
    [setMuted]
  );

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
    const state: CoffeeGameState = { ...INITIAL_GAME_STATE, lastActor: clientActor };
    const room = await createRoom('coffee', state);
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
      if (!mounted) return;

      // 없는/만료된 방에서는 모든 조작이 저장에 실패해 화면이 멈추므로 로컬 모드로 돌려보낸다
      if (!room || isRoomExpired(room.created_at)) {
        window.alert('방을 찾을 수 없거나 만료된 링크예요. 새 방을 만들어 주세요.');
        router.replace(COFFEE_HOME);
        return;
      }

      applyRealtimeState(room.game_state);
      setRoomInfo({ name: room.name, maxCapacity: room.max_capacity });
    });

    const { unsubscribe } = subscribeRoomState<CoffeeGameState>({
      roomId,
      onState: state => {
        if (!mounted) return;
        // 내 낙관적 업데이트보다 뒤처진(이미 지나간) 상태는 무시한다
        if (state.revision < realtimeStateRef.current.revision) return;
        applyRealtimeState(state);
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applyRealtimeState, roomId, router]);

  useEffect(() => {
    if (!isRealtimeEnabled) return;
    if (currentStep !== 3 || realtimeState.result) return;

    void pushRealtimeState(currentState => ({
      step: currentState.step,
      orderState: currentState.orderState,
      result: currentState.result ?? getLottery(currentState.orderState.total, currentState.orderState.boom).join(','),
    }));
  }, [currentStep, isRealtimeEnabled, pushRealtimeState, realtimeState.result]);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribePresence(roomId, presence => {
      const simplified: Record<string, { actor: string; cardIndex: number | null }> = {};

      Object.values(presence).forEach(meta => {
        if (typeof meta.actor !== 'string') return;
        simplified[meta.actor] = {
          actor: meta.actor,
          cardIndex: typeof meta.cardIndex === 'number' ? meta.cardIndex : null,
        };
      });

      setActiveSelections(simplified);
    });

    if (clientActor !== 'guest') {
      trackPresence(roomId, { actor: clientActor, cardIndex: null });
    }

    return unsubscribe;
  }, [roomId, clientActor]);

  return (
    <div className="relative pb-28">
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
      <RoomSharePanel
        gameType="coffee"
        roomId={roomId}
        localActor={clientActor}
        hasConfig={hasRealtimeConfig()}
        preferFloatingEntry
        onCreateRoom={handleCreateRoom}
        lastActor={isRealtimeEnabled ? realtimeState.lastActor : clientActor}
        roomName={roomInfo.name}
        maxCapacity={roomInfo.maxCapacity}
      />
    </div>
  );
}

export default function Coffee() {
  return (
    <Suspense fallback={<div className="h-screen w-screen" />}>
      <CoffeeContent />
    </Suspense>
  );
}
