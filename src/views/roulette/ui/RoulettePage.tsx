'use client';
import { Suspense } from 'react';
import Image from 'next/image';

import prevBtnIcon from '@/public/button/button_prev.svg';
import Start from '@/domains/roulette/Start';
import Order from '@/domains/roulette/Order';

import { RouletteContext } from '@/lib/context/roulette';
import Loading from '@/domains/roulette/Loading';
import { hasRealtimeConfig, roomErrorMessage } from '@/src/entities/room';
import { RoomSharePanel } from '@/src/widgets/room-share';

import { useRouletteView } from '../model/useRouletteView';

function RouletteContent() {
  const {
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
  } = useRouletteView();
  return (
    <div className="relative pb-28">
      {(!roomId || isHost) && currentStep !== 0 && (
        <Image
          className="fixed z-[var(--nav-z-index)] top-16 left-2 cursor-pointer"
          src={prevBtnIcon}
          alt="이전 버튼"
          width={32}
          height={32}
          onClick={() => handleStepWithSync('prev')}
        />
      )}
      <RouletteContext.Provider
        value={{
          orderState: currentOrderState,
          handleOrder,
        }}
      >
        <fieldset className="contents" disabled={Boolean(roomId) && (!isHost || live.status !== 'connected')}>
          <Container curStep={currentStep}>
            <Start handleStep={handleStepWithSync} />
            <Order handleStep={handleStepWithSync} />
            <Loading
              handleStep={handleStepWithSync}
              onReplay={handleReplay}
              resultIndex={isRealtimeEnabled ? realtimeState.resultIndex : localResultIndex}
            />
          </Container>
        </fieldset>
      </RouletteContext.Provider>
      <RoomSharePanel
        gameType="roulette"
        roomId={roomId}
        localActor={clientActor}
        hasConfig={hasRealtimeConfig()}
        presenceActors={live.members.map(member => member.actorId)}
        connectionStatus={live.status}
        connectionError={roomErrorMessage(live.error)}
        expiresAt={live.room?.expiresAt}
        onRetry={live.retry}
        preferFloatingEntry
        onCreateRoom={handleCreateRoom}
        lastActor={isRealtimeEnabled ? realtimeState.lastActor : clientActor}
        roomName={roomInfo.name}
        maxCapacity={roomInfo.maxCapacity}
      />
    </div>
  );
}

export default function RoulettePage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen" />}>
      <RouletteContent />
    </Suspense>
  );
}
