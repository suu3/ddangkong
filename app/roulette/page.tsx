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
import { createRoom, getRoom, updateRoomState } from '@/lib/realtime/rooms';
import { subscribeRoomState } from '@/lib/realtime/channel';
import RoomSharePanel from '@/components/realtime/RoomSharePanel';
import { hasSupabaseConfig } from '@/lib/supabase/env';
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

  const roomId = searchParams.get('roomId');
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
  const sendStateRef = React.useRef<((state: RouletteGameState) => void) | null>(null);

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
      sendStateRef.current?.(optimisticState);

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
          sendStateRef.current?.(retriedState);

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
      if (!mounted || !room) return;
      applyRealtimeState(room.game_state);
      setRoomInfo({ name: room.name, maxCapacity: room.max_capacity });
    });

    const { unsubscribe, sendState } = subscribeRoomState<RouletteGameState>({
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
    if (currentStep !== 2 || realtimeState.resultIndex !== null) return;
    if (currentOrderState.total.length === 0) return;

    void pushRealtimeState(currentState => ({
      step: currentState.step,
      orderState: currentState.orderState,
      resultIndex: Math.floor(Math.random() * currentState.orderState.total.length),
    }));
  }, [currentOrderState.total.length, currentStep, isRealtimeEnabled, pushRealtimeState, realtimeState.resultIndex]);

  useEffect(() => {
    if (isRealtimeEnabled) return;
    if (currentStep !== 2 || localResultIndex !== null) return;
    if (currentOrderState.total.length === 0) return;

    setLocalResultIndex(Math.floor(Math.random() * currentOrderState.total.length));
  }, [currentOrderState.total.length, currentStep, isRealtimeEnabled, localResultIndex]);

  return (
    <div className="relative">
      <RoomSharePanel
        gameType="roulette"
        roomId={roomId}
        localActor={clientActor}
        hasConfig={hasSupabaseConfig()}
        preferFloatingEntry
        onCreateRoom={handleCreateRoom}
        lastActor={isRealtimeEnabled ? realtimeState.lastActor : clientActor}
        roomName={roomInfo.name}
        maxCapacity={roomInfo.maxCapacity}
      />
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
