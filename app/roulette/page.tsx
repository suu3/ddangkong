'use client';

import React, { Suspense, useCallback, useEffect, useReducer } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

import useStep from '@/lib/hooks/useStep';
import prevBtnIcon from '@/public/button/button_prev.svg';
import Start from '@/domains/roulette/Start';
import Order from '@/domains/roulette/Order';
import { RouletteAction, rouletteReducer } from '@/lib/reducer/roulette';
import { RouletteContext, initialRouletteState } from '@/lib/context/roulette';
import Loading from '@/domains/roulette/Loading';
import { createRoom, getRoom, isRoomExpired, updateRoomState } from '@/lib/realtime/rooms';
import { ROULETTE_HOME } from '@/lib/constants/serviceUrls';
import { subscribeRoomState } from '@/lib/realtime/channel';
import RoomSharePanel from '@/components/realtime/RoomSharePanel';
import { hasRealtimeConfig } from '@/lib/realtime/env';
import { getServerActor } from '@/lib/realtime/clientActor';

interface RouletteGameState {
  step: number;
  orderState: typeof initialRouletteState;
  resultIndex: number | null;
  revision: number;
  lastActor: string | null;
}

type RealtimeDraftState = Omit<RouletteGameState, 'revision' | 'lastActor'>;

function CoffeeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 실시간 서버 설정이 없으면 roomId가 붙은 링크로 들어와도 로컬 모드로 동작한다
  const roomId = hasRealtimeConfig() ? searchParams.get('roomId') : null;
  const isRealtimeEnabled = Boolean(roomId);

  const [step, Container, handleStep] = useStep(0);
  const [clientActor, setClientActor] = React.useState('guest');
  const [orderState, orderDispatch] = useReducer(rouletteReducer, initialRouletteState);
  const [localResultIndex, setLocalResultIndex] = React.useState<number | null>(null);
  const [realtimeState, setRealtimeState] = React.useState<RouletteGameState>({
    step: 0,
    orderState: initialRouletteState,
    resultIndex: null,
    revision: 0,
    lastActor: null,
  });
  const realtimeStateRef = React.useRef<RouletteGameState>({
    step: 0,
    orderState: initialRouletteState,
    resultIndex: null,
    revision: 0,
    lastActor: null,
  });
  const [roomInfo, setRoomInfo] = React.useState<{ name: string | null; maxCapacity: number | null }>({
    name: null,
    maxCapacity: null,
  });

  const currentStep = isRealtimeEnabled ? realtimeState.step : step;
  const currentOrderState = isRealtimeEnabled ? realtimeState.orderState : orderState;

  const applyRealtimeState = useCallback((nextState: RouletteGameState) => {
    realtimeStateRef.current = nextState;
    setRealtimeState(nextState);
  }, []);

  const pushRealtimeState = useCallback(
    async (makeNextState: (currentState: RouletteGameState) => RealtimeDraftState) => {
      if (!roomId) return;

      const previousState = realtimeStateRef.current;
      const optimisticState: RouletteGameState = {
        ...makeNextState(previousState),
        revision: previousState.revision + 1,
        lastActor: clientActor,
      };

      applyRealtimeState(optimisticState);

      try {
        await updateRoomState(roomId, optimisticState, previousState.revision);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Realtime conflict')) {
          const latest = await getRoom<RouletteGameState>(roomId);
          if (!latest) {
            applyRealtimeState(previousState);
            return;
          }

          const latestState = latest.game_state;
          applyRealtimeState(latestState);

          const retriedState: RouletteGameState = {
            ...makeNextState(latestState),
            revision: latestState.revision + 1,
            lastActor: clientActor,
          };

          applyRealtimeState(retriedState);

          try {
            await updateRoomState(roomId, retriedState, latestState.revision);
          } catch (retryError) {
            applyRealtimeState(latestState);
            console.error('Failed to retry realtime state update', retryError);
            return;
          }

          return;
        }

        applyRealtimeState(previousState);
        console.error('Failed to update realtime state', error);
        return;
      }
    },
    [applyRealtimeState, clientActor, roomId]
  );

  const handleOrder = ({ type, payload }: RouletteAction) => {
    if (isRealtimeEnabled) {
      if (type === 'ADD_ITEM') {
        const appendedItem = payload[payload.length - 1];
        if (!appendedItem) return;

        void pushRealtimeState(currentState => ({
          step: currentState.step,
          orderState: {
            ...currentState.orderState,
            total: [...currentState.orderState.total, appendedItem],
          },
          resultIndex: null,
        }));
        return;
      }

      const nextOrderState = rouletteReducer(currentOrderState, { type, payload });
      void pushRealtimeState(currentState => ({
        step: currentState.step,
        orderState: nextOrderState,
        resultIndex: null,
      }));
      return;
    }

    setLocalResultIndex(null);
    orderDispatch({ type, payload });
  };

  const handleStepWithSync = (type: 'next' | 'prev') => {
    if (isRealtimeEnabled) {
      void pushRealtimeState(currentState => ({
        step: type === 'next' ? currentState.step + 1 : Math.max(0, currentState.step - 1),
        orderState: currentState.orderState,
        resultIndex: type === 'prev' ? null : currentState.resultIndex,
      }));
      return;
    }

    if (type === 'prev') {
      setLocalResultIndex(null);
    }
    handleStep(type);
  };

  const handleReplay = () => {
    if (isRealtimeEnabled) {
      void pushRealtimeState(() => ({
        step: 1,
        orderState: initialRouletteState,
        resultIndex: null,
      }));
      return;
    }

    setLocalResultIndex(null);
    orderDispatch({ type: 'ADD_ITEM', payload: [] });
    handleStep('prev');
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
    const state: RouletteGameState = {
      step: 0,
      orderState: initialRouletteState,
      resultIndex: null,
      revision: 0,
      lastActor: clientActor,
    };

    const room = await createRoom('roulette', state);
    router.push(`/roulette?roomId=${room.id}`);
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

    getRoom<RouletteGameState>(roomId).then(room => {
      if (!mounted) return;

      // 없는/만료된 방에서는 모든 조작이 저장에 실패해 화면이 멈추므로 로컬 모드로 돌려보낸다
      if (!room || isRoomExpired(room.created_at)) {
        window.alert('방을 찾을 수 없거나 만료된 링크예요. 새 방을 만들어 주세요.');
        router.replace(ROULETTE_HOME);
        return;
      }

      applyRealtimeState(room.game_state);
      setRoomInfo({ name: room.name, maxCapacity: room.max_capacity });
    });

    const { unsubscribe } = subscribeRoomState<RouletteGameState>({
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
    if (currentStep !== 2 || realtimeState.resultIndex !== null) return;
    if (currentOrderState.total.length === 0) return;

    void pushRealtimeState(currentState => ({
      step: currentState.step,
      orderState: currentState.orderState,
      // 두 클라이언트가 동시에 뽑아 충돌 재시도가 일어나도, 먼저 저장된 결과를 덮어쓰지 않는다
      resultIndex: currentState.resultIndex ?? Math.floor(Math.random() * currentState.orderState.total.length),
    }));
  }, [currentOrderState.total.length, currentStep, isRealtimeEnabled, pushRealtimeState, realtimeState.resultIndex]);

  useEffect(() => {
    if (isRealtimeEnabled) return;
    if (currentStep !== 2 || localResultIndex !== null) return;
    if (currentOrderState.total.length === 0) return;

    setLocalResultIndex(Math.floor(Math.random() * currentOrderState.total.length));
  }, [currentOrderState.total.length, currentStep, isRealtimeEnabled, localResultIndex]);

  return (
    <div className="relative pb-28">
      {renderPrevBtn}
      <RouletteContext.Provider
        value={{
          orderState: currentOrderState,
          handleOrder,
        }}
      >
        <Container curStep={currentStep}>
          <Start handleStep={handleStepWithSync} />
          <Order handleStep={handleStepWithSync} />
          <Loading
            handleStep={handleStepWithSync}
            onReplay={handleReplay}
            resultIndex={isRealtimeEnabled ? realtimeState.resultIndex : localResultIndex}
          />
        </Container>
      </RouletteContext.Provider>
      <RoomSharePanel
        gameType="roulette"
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
