'use client';
import React, { useCallback, useEffect, useReducer } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import useStep from '@/lib/hooks/useStep';

import { RouletteAction, rouletteReducer } from '@/lib/reducer/roulette';
import { initialRouletteState } from '@/lib/context/roulette';

import { useRoom, createRoom } from '@/src/entities/room';

import { getServerActor } from '@/src/entities/room';
export interface RouletteGameState {
  step: number;
  orderState: typeof initialRouletteState;
  resultIndex: number | null;
  revision: number;
  lastActor: string | null;
}

export type RealtimeDraftState = Omit<RouletteGameState, 'revision' | 'lastActor'>;

export function useRouletteView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const isRealtimeEnabled = Boolean(roomId);
  const [step, Container, handleStep] = useStep(0);
  const [localActor, setClientActor] = React.useState('guest');
  const live = useRoom<RouletteGameState>(roomId, 'roulette');
  const { isHost, mutate } = live;
  const clientActor = roomId ? live.actorId : localActor;
  const [orderState, orderDispatch] = useReducer(rouletteReducer, initialRouletteState);
  const [localResultIndex, setLocalResultIndex] = React.useState<number | null>(null);
  const localGameState = { step: 0, orderState: initialRouletteState, resultIndex: null, revision: 0, lastActor: null };
  const realtimeState = roomId ? (live.state ?? localGameState) : localGameState;
  const roomInfo = { name: live.room?.name ?? null, maxCapacity: live.room?.maxCapacity ?? null };
  const currentStep = isRealtimeEnabled ? realtimeState.step : step;
  const currentOrderState = isRealtimeEnabled ? realtimeState.orderState : orderState;
  const pushRealtimeState = useCallback(
    async (makeNextState: (current: RouletteGameState) => RealtimeDraftState) => {
      if (!roomId || !isHost) return;
      try {
        await mutate(current => {
          return { ...current, ...makeNextState(current) };
        });
        return;
      } catch (error) {
        console.error(error);
        return;
      }
    },
    [roomId, isHost, mutate]
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
    if (!isRealtimeEnabled || !isHost) return;
    if (currentStep !== 2 || realtimeState.resultIndex !== null) return;
    if (currentOrderState.total.length === 0) return;

    void pushRealtimeState(currentState => ({
      step: currentState.step,
      orderState: currentState.orderState,
      resultIndex: Math.floor(Math.random() * currentState.orderState.total.length),
    }));
  }, [
    currentOrderState.total.length,
    currentStep,
    isRealtimeEnabled,
    isHost,
    pushRealtimeState,
    realtimeState.resultIndex,
  ]);
  useEffect(() => {
    if (isRealtimeEnabled) return;
    if (currentStep !== 2 || localResultIndex !== null) return;
    if (currentOrderState.total.length === 0) return;

    setLocalResultIndex(Math.floor(Math.random() * currentOrderState.total.length));
  }, [currentOrderState.total.length, currentStep, isRealtimeEnabled, localResultIndex]);
  return {
    roomId,
    isRealtimeEnabled,
    Container,
    live,
    isHost,
    clientActor,
    localResultIndex,
    realtimeState,
    roomInfo,
    currentStep,
    currentOrderState,
    handleOrder,
    handleStepWithSync,
    handleReplay,
    handleCreateRoom,
  };
}
