'use client';

import React, { useEffect, useReducer } from 'react';
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

interface CoffeeGameState {
  step: number;
  orderState: typeof initialCoffeeState;
}

export default function Coffee() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId = searchParams.get('roomId');
  const role = (searchParams.get('role') as 'host' | 'viewer') ?? 'host';
  const isRealtimeEnabled = Boolean(roomId);
  const isHost = role !== 'viewer';

  const [step, Container, handleStep] = useStep(0);
  const [orderState, orderDispatch] = useReducer(coffeeReducer, initialCoffeeState);
  const [allMuteState, soundDispatch] = useReducer(soundReducer, initialallMuteState);
  const [realtimeState, setRealtimeState] = React.useState<CoffeeGameState>({
    step: 0,
    orderState: initialCoffeeState,
  });
  const { playerRef, playSound } = usePlayAudio();

  const currentStep = isRealtimeEnabled ? realtimeState.step : step;
  const currentOrderState = isRealtimeEnabled ? realtimeState.orderState : orderState;
  const isMainStep = currentStep === 0;

  const pushRealtimeState = async (nextState: CoffeeGameState) => {
    if (!roomId) return;
    setRealtimeState(nextState);
    await updateRoomState(roomId, nextState);
  };

  const handleOrder = (type: CoffeeActionType) => {
    if (isRealtimeEnabled && !isHost) return;

    if (isRealtimeEnabled) {
      const nextOrderState = coffeeReducer(currentOrderState, { type });
      pushRealtimeState({
        step: currentStep,
        orderState: nextOrderState,
      });
      return;
    }

    orderDispatch({ type });
  };

  const handleStepWithSync = (type: 'next' | 'prev') => {
    if (isRealtimeEnabled && !isHost) return;

    if (isRealtimeEnabled) {
      const nextStep = type === 'next' ? currentStep + 1 : Math.max(0, currentStep - 1);
      pushRealtimeState({
        step: nextStep,
        orderState: currentOrderState,
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
    const state: CoffeeGameState = {
      step: 0,
      orderState: initialCoffeeState,
    };
    const room = await createRoom('coffee', state);
    router.push(`/coffee?roomId=${room.id}&role=host`);
  };

  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    getRoom<CoffeeGameState>(roomId).then(room => {
      if (!mounted || !room) return;
      setRealtimeState(room.game_state);
    });

    const unsubscribe = subscribeRoomState<CoffeeGameState>({
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
    playSound(playerRef?.current?.audio?.current);
  }, [allMuteState.isAllMuted, playSound, playerRef]);

  // useEffect(() => {
  //   const button = document.createElement('button');
  //   document.body.appendChild(button);
  //   button.addEventListener('click', () => {
  //     button.remove();
  //   }
  // }, []);

  return (
    <div className="relative">
      <RoomSharePanel
        gameType="coffee"
        roomId={roomId}
        role={isHost ? 'host' : 'viewer'}
        hasConfig={hasSupabaseConfig()}
        onCreateRoom={handleCreateRoom}
      />
      {renderPrevBtn}
      <CoffeeContext.Provider
        value={{
          orderState: currentOrderState,
          allMuteState,
          handleOrder,
          handleAllMute,
        }}
      >
        {!isMainStep && <AudioPlayer volume={0.4} ref={playerRef} src={BGM_URL} muted={allMuteState.isAllMuted} />}
        {!isMainStep && <PlayerButton onSoundToggle={onSoundToggle} muted={allMuteState.isAllMuted} />}
        <Container curStep={currentStep}>
          <Start handleStep={handleStepWithSync} />
          <Order state={currentOrderState} handleStep={handleStepWithSync} />
          <Shuffle cnt={currentOrderState.total} handleStep={handleStepWithSync} />
          <Loading />
        </Container>
      </CoffeeContext.Provider>
    </div>
  );
}
