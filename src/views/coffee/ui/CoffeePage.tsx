'use client';
import { Suspense } from 'react';
import Image from 'next/image';

import Loading from '@/domains/coffee/Loading';
import Order from '@/domains/coffee/Order';
import Shuffle from '@/domains/coffee/Shuffle';
import Start from '@/domains/coffee/Start';

import { CoffeeContext } from '@/lib/context/coffee';
import prevBtnIcon from '@/public/button/button_prev.svg';
import { hasRealtimeConfig, roomErrorMessage } from '@/src/entities/room';
import { RoomSharePanel } from '@/src/widgets/room-share';

import { useCoffeeView } from '../model/useCoffeeView';

function CoffeeContent() {
  const {
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
  } = useCoffeeView();
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
        <fieldset
          className="contents"
          disabled={Boolean(roomId) && ((!isHost && currentStep < 2) || live.status !== 'connected')}
        >
          <Container curStep={currentStep}>
            <Start handleStep={handleStepWithSync} />
            <Order state={currentOrderState} handleStep={handleStepWithSync} />
            <Shuffle cnt={currentOrderState.total} handleStep={handleStepWithSync} canControl={!roomId || isHost} />
            <Loading
              resultValue={isRealtimeEnabled ? realtimeState.result : undefined}
              roomId={roomId}
              isRealtimeEnabled={isRealtimeEnabled}
            />
          </Container>
        </fieldset>
      </CoffeeContext.Provider>
      <RoomSharePanel
        gameType="coffee"
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

export default function CoffeePage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen" />}>
      <CoffeeContent />
    </Suspense>
  );
}
