'use client';
import React, { useCallback, useEffect, useReducer } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import useStep from '@/lib/hooks/useStep';
import { coffeeReducer, CoffeeActionType } from '@/lib/reducer/coffee';
import { initialCoffeeState } from '@/lib/context/coffee';

import { useRoom, createRoom } from '@/src/entities/room';

import { getLottery } from '@/lib/utils/random';
import { getServerActor } from '@/src/entities/room';
import { useSound } from '@/lib/context/sound';
export interface CoffeeGameState {
  step: number;
  orderState: typeof initialCoffeeState;
  result: string | null;
  revision: number;
  lastActor: string | null;
  selections: Record<string, number | null>; // actorId -> cardIndex
}

export type RealtimeDraftState = Omit<CoffeeGameState, 'revision' | 'lastActor' | 'selections'>;

export const INITIAL_GAME_STATE: CoffeeGameState = {
  step: 0,
  orderState: initialCoffeeState,
  result: null,
  revision: 0,
  lastActor: null,
  selections: {},
};

export function useCoffeeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const isRealtimeEnabled = Boolean(roomId);
  const [step, Container, handleStep] = useStep(0);
  const [localActor, setClientActor] = React.useState('guest');
  const live = useRoom<CoffeeGameState>(roomId, 'coffee');
  const { isHost, mutate, command, updatePresence } = live;
  const clientActor = roomId ? live.actorId : localActor;
  const [orderState, orderDispatch] = useReducer(coffeeReducer, initialCoffeeState);
  const localGameState = INITIAL_GAME_STATE;
  const realtimeState = roomId ? (live.state ?? localGameState) : localGameState;
  const roomInfo = { name: live.room?.name ?? null, maxCapacity: live.room?.maxCapacity ?? null };
  const activeSelections = React.useMemo(
    () =>
      Object.fromEntries(
        live.members.map(member => [
          member.actorId,
          {
            actor: member.actorId,
            cardIndex: member.presence.cardIndex ?? realtimeState.selections[member.actorId] ?? null,
          },
        ])
      ),
    [live.members, realtimeState.selections]
  );
  const { isMuted, setMuted } = useSound();
  const currentStep = isRealtimeEnabled ? realtimeState.step : step;
  const currentOrderState = isRealtimeEnabled ? realtimeState.orderState : orderState;
  const allMuteState = React.useMemo(() => ({ isAllMuted: isMuted }), [isMuted]);
  const pushRealtimeState = useCallback(
    async (makeNextState: (current: CoffeeGameState) => RealtimeDraftState) => {
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
  const handleCardSelect = useCallback(
    (cardIndex: number | null) => {
      updatePresence?.(cardIndex);
      if (isRealtimeEnabled) void command?.({ kind: 'coffee.select', cardIndex }).catch(() => {});
    },
    [updatePresence, command, isRealtimeEnabled]
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
    if (!isRealtimeEnabled || !isHost) return;
    if (currentStep !== 3 || realtimeState.result) return;

    void pushRealtimeState(currentState => ({
      step: currentState.step,
      orderState: currentState.orderState,
      result: currentState.result ?? getLottery(currentState.orderState.total, currentState.orderState.boom).join(','),
    }));
  }, [currentStep, isRealtimeEnabled, isHost, pushRealtimeState, realtimeState.result]);
  return {
    roomId,
    isRealtimeEnabled,
    Container,
    live,
    isHost,
    clientActor,
    realtimeState,
    roomInfo,
    activeSelections,
    currentStep,
    currentOrderState,
    allMuteState,
    handleCardSelect,
    handleOrder,
    handleStepWithSync,
    handleAllMute,
    handleCreateRoom,
  };
}
