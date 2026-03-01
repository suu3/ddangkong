'use client';

import React, { useCallback, useEffect, useReducer } from 'react';
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

export default function Coffee() {
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
  const [roomInfo, setRoomInfo] = React.useState<{ name: string | null; maxCapacity: number | null }>({
    name: null,
    maxCapacity: null,
  });
  const sendStateRef = React.useRef<((state: RouletteGameState) => void) | null>(null);

  const currentStep = isRealtimeEnabled ? realtimeState.step : step;
  const currentOrderState = isRealtimeEnabled ? realtimeState.orderState : orderState;

  const pushRealtimeState = useCallback(
    async (nextState: Omit<RouletteGameState, 'revision' | 'lastActor'>) => {
      if (!roomId) return;

      const previousState = realtimeState;
      const optimisticState: RouletteGameState = {
        ...nextState,
        revision: previousState.revision + 1,
        lastActor: clientActor,
      };

      // 1. 로컬 상태 즉시 업데이트
      setRealtimeState(optimisticState);

      // 2. 다른 참여자에게 Broadcast 즉시 전송
      sendStateRef.current?.(optimisticState);

      // 3. DB 비동기 업데이트
      try {
        await updateRoomState(roomId, optimisticState, previousState.revision);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Realtime conflict')) {
          const latest = await getRoom<RouletteGameState>(roomId);
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

  const handleOrder = ({ type, payload }: RouletteAction) => {
    if (isRealtimeEnabled) {
      const nextOrderState = rouletteReducer(currentOrderState, { type, payload });
      void pushRealtimeState({
        step: currentStep,
        orderState: nextOrderState,
        resultIndex: null,
      });
      return;
    }

    setLocalResultIndex(null);
    orderDispatch({ type, payload });
  };

  const handleStepWithSync = (type: 'next' | 'prev') => {
    if (isRealtimeEnabled) {
      const nextStep = type === 'next' ? currentStep + 1 : Math.max(0, currentStep - 1);
      void pushRealtimeState({
        step: nextStep,
        orderState: currentOrderState,
        resultIndex: type === 'prev' ? null : realtimeState.resultIndex,
      });
      return;
    }

    if (type === 'prev') {
      setLocalResultIndex(null);
    }
    handleStep(type);
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
      setRealtimeState(room.game_state);
      setRoomInfo({ name: room.name, maxCapacity: room.max_capacity });
    });

    const { unsubscribe, sendState } = subscribeRoomState<RouletteGameState>({
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
    if (currentStep !== 2 || realtimeState.resultIndex !== null) return;
    if (currentOrderState.total.length === 0) return;

    const resultIndex = Math.floor(Math.random() * currentOrderState.total.length);
    void pushRealtimeState({
      step: currentStep,
      orderState: currentOrderState,
      resultIndex,
    });
  }, [currentOrderState, currentStep, isRealtimeEnabled, pushRealtimeState, realtimeState.resultIndex]);

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
            resultIndex={isRealtimeEnabled ? realtimeState.resultIndex : localResultIndex}
          />
        </Container>
      </RouletteContext.Provider>
    </div>
  );
}
