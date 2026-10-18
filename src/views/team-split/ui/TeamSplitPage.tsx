'use client';
import clsx from 'clsx';
import Image from 'next/image';

import { Suspense } from 'react';
import MainButton from '@/components/button/MainButton';
import Tooltip from '@/components/Tooltip';
import UniqueText from '@/components/UniqueText';
import { hasRealtimeConfig, roomErrorMessage } from '@/src/entities/room';
import { RoomSharePanel } from '@/src/widgets/room-share';

import teamSplitImage from '@/public/split-team/main.png';
import { useTeamSplitView, TeamCount, TEAM_LABELS } from '../model/useTeamSplitView';

function TeamSplitPageContent() {
  const {
    roomId,
    isRealtimeEnabled,
    live,
    isHost,
    clientActor,
    errorBanner,
    membersText,
    setMembersText,
    setHasEntered,
    realtimeState,
    roomInfo,
    currentTeamCount,
    currentResult,
    currentLastShuffledAt,
    parsedMembers,
    showIntro,
    handleCreateRoom,
    handleTeamCountChange,
    handleSplit,
  } = useTeamSplitView();
  return (
    <div className="relative px-4 pb-28 pt-10">
      {showIntro ? (
        <section className="relative mx-auto flex max-w-xl flex-col items-center justify-center text-center">
          <UniqueText Tag="h1" font="sans" size="lg" className="relative mt-4 text-center text-chocolate">
            랜덤 팀
            <br />
            <span className="text-[3.625rem] leading-[103.8%]">나누기</span>
          </UniqueText>
          <div className="relative mt-8 w-full max-w-[20rem]">
            <Image
              src={teamSplitImage}
              alt="팀 나누기 메인 일러스트"
              priority
              className="relative mx-auto w-full max-w-[18rem] animate-[float_4.8s_ease-in-out_infinite]"
            />
          </div>
          <div className="relative mt-10 w-full max-w-[15rem]">
            <div className="absolute left-1/2 top-[calc(-100%)] -translate-x-1/2 -translate-y-2">
              <Tooltip className="animate-bounce" visible>
                Click !
              </Tooltip>
            </div>
            <MainButton onClick={() => setHasEntered(true)} variant="contained" color="chocolate">
              시작하기
            </MainButton>
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-xl rounded-[2rem] border border-chocolate07 bg-white p-5 shadow-sm">
          <UniqueText Tag="h1" font="sans" size="lg" className="text-center text-chocolate">
            랜덤 팀
            <br />
            <span className="text-[3.625rem] leading-[103.8%]">나누기</span>
          </UniqueText>

          {errorBanner && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorBanner.message}
            </div>
          )}

          <section className="mt-5 rounded-[1.5rem] border border-chocolate07 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-800">참여자 입력</h2>
            <p className="mt-1 text-xs text-gray-500">한 줄에 한 명씩 입력하세요. 현재 {parsedMembers.length}명</p>
            <textarea
              disabled={Boolean(roomId) && (!isHost || live.status !== 'connected')}
              value={membersText}
              onChange={event => setMembersText(event.target.value)}
              placeholder={'민지\n현우\n유진\n서준\n도윤\n지우'}
              className="mt-3 h-48 w-full resize-none rounded-[1.25rem] border border-chocolate07 bg-white p-3 text-sm outline-none transition-colors focus:border-chocolate07"
            />
          </section>

          <section className="mt-4 rounded-[1.5rem] border border-chocolate07 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-800">옵션</h2>
            <div className="mt-3 flex gap-2">
              {[2, 3, 4].map(option => {
                const selected = currentTeamCount === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void handleTeamCountChange(option as TeamCount)}
                    disabled={Boolean(roomId) && (!isHost || live.status !== 'connected')}
                    aria-pressed={selected}
                    className={clsx(
                      'h-11 flex-1 rounded-full border-2 text-sm font-semibold transition-all duration-150',
                      selected
                        ? 'border-chocolate07 bg-chocolate07 text-white'
                        : 'border-chocolate07 bg-white text-chocolate07'
                    )}
                  >
                    {option}팀
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <MainButton
                variant="contained"
                color="chocolate"
                disabled={Boolean(roomId) && (!isHost || live.status !== 'connected')}
                onClick={() => void handleSplit()}
              >
                팀 나누기
              </MainButton>
            </div>
          </section>

          <section className="mt-4 rounded-[1.5rem] border border-chocolate07 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-chocolate07">결과</h2>
              {currentLastShuffledAt && (
                <p className="text-xs text-chocolate06">
                  최근 실행 {new Date(currentLastShuffledAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentResult.map((teamMembers, index) => (
                <div key={TEAM_LABELS[index]} className="rounded-[1.25rem] border border-chocolate07 bg-white p-3">
                  <p className="text-sm font-bold text-chocolate07">TEAM {TEAM_LABELS[index]}</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-700">
                    {teamMembers.length === 0 ? (
                      <li className="text-gray-400">아직 결과가 없어요</li>
                    ) : (
                      teamMembers.map(member => <li key={`${TEAM_LABELS[index]}-${member}`}>{member}</li>)
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <RoomSharePanel
        gameType="team_split"
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

export default function TeamSplitPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen" />}>
      <TeamSplitPageContent />
    </Suspense>
  );
}
