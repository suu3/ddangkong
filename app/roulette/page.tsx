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

interface RouletteGameState {
  step: number;
  orderState: typeof initialRouletteState;
  resultIndex: number | null;
}

export default function Coffee() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId = searchParams.get('roomId');
  const role = (searchParams.get('role') as 'host' | 'viewer') ?? 'host';
  const isRealtimeEnabled = Boolean(roomId);
  const isHost = role !== 'viewer';

  const [step, Container, handleStep] = useStep(0);
  const [orderState, orderDispatch] = useReducer(rouletteReducer, initialRouletteState);
  const [realtimeState, setRealtimeState] = React.useState<RouletteGameState>({
    step: 0,
    orderState: initialRouletteState,
    resultIndex: null,
  });

  const currentStep = isRealtimeEnabled ? realtimeState.step : step;
  const currentOrderState = isRealtimeEnabled ? realtimeState.orderState : orderState;

  const pushRealtimeState = useCallback(async (nextState: RouletteGameState) => {
    if (!roomId) return;
    setRealtimeState(nextState);
    await updateRoomState(roomId, nextState);
  }, [roomId]);

  const handleOrder = ({ type, payload }: RouletteAction) => {
    if (isRealtimeEnabled && !isHost) return;

    if (isRealtimeEnabled) {
      const nextOrderState = rouletteReducer(currentOrderState, { type, payload });
      pushRealtimeState({
        step: currentStep,
        orderState: nextOrderState,
        resultIndex: null,
      });
      return;
    }

    orderDispatch({ type, payload });
  };

  const handleStepWithSync = (type: 'next' | 'prev') => {
    if (isRealtimeEnabled && !isHost) return;

    if (isRealtimeEnabled) {
      const nextStep = type === 'next' ? currentStep + 1 : Math.max(0, currentStep - 1);
      pushRealtimeState({
        step: nextStep,
        orderState: currentOrderState,
        resultIndex: type === 'prev' ? null : realtimeState.resultIndex,
      });
      return;
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
    };

    const room = await createRoom('roulette', state);
    router.push(`/roulette?roomId=${room.id}&role=host`);
  };

  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    getRoom<RouletteGameState>(roomId).then(room => {
      if (!mounted || !room) return;
      setRealtimeState(room.game_state);
    });

    const unsubscribe = subscribeRoomState<RouletteGameState>({
      roomId,
      onState: state => {
        if (!mounted) return;
        setRealtimeState(state);
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [roomId]);

  useEffect(() => {
    if (!isRealtimeEnabled || !isHost) return;
    if (currentStep !== 2 || realtimeState.resultIndex !== null) return;
    if (currentOrderState.total.length === 0) return;

    const resultIndex = Math.floor(Math.random() * currentOrderState.total.length);
    pushRealtimeState({
      step: currentStep,
      orderState: currentOrderState,
      resultIndex,
    });
  }, [currentOrderState, currentStep, isHost, isRealtimeEnabled, pushRealtimeState, realtimeState.resultIndex]);

  return (
    <div className="relative">
      <RoomSharePanel
        gameType="roulette"
        roomId={roomId}
        role={isHost ? 'host' : 'viewer'}
        hasConfig={hasSupabaseConfig()}
        onCreateRoom={handleCreateRoom}
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
          <Loading handleStep={handleStepWithSync} resultIndex={isRealtimeEnabled ? realtimeState.resultIndex : null} />
        </Container>
      </RouletteContext.Provider>
    </div>
  );
}
