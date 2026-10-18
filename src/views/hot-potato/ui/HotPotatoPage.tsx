'use client';
import { Suspense } from 'react';

import Image from 'next/image';
import MainButton from '@/components/button/MainButton';
import Tooltip from '@/components/Tooltip';
import UniqueText from '@/components/UniqueText';
import { hasRealtimeConfig, roomErrorMessage } from '@/src/entities/room';
import { RoomSharePanel } from '@/src/widgets/room-share';

import { useHotPotatoView, DURATION_OPTIONS } from '../model/useHotPotatoView';

function HotPotatoPageContent() {
  const {
    roomId,
    live,
    clientActor,
    roomState,
    roomInfo,
    errorBanner,
    nicknameInput,
    setNicknameInput,
    setHasEntered,
    effectivePlayers,
    holderPlayer,
    nicknameByUserId,
    winnerPlayer,
    canStart,
    cooldownRemainingMs,
    timerRemainingMs,
    canPass,
    handleCreateRoom,
    handleToggleReady,
    handleSaveNickname,
    handleStartGame,
    handlePass,
    handleConfigChange,
    handleReset,
    statusText,
    progress,
    showIntro,
  } = useHotPotatoView();
  return (
    <div className="relative px-4 pb-28 pt-10">
      {showIntro && (
        <section className="relative mx-auto flex max-w-xl flex-col items-center justify-center text-center">
          <UniqueText Tag="h1" font="sans" size="lg" className="relative mt-4 text-center text-chocolate">
            폭탄
            <br />
            <span className="text-[3.625rem] leading-[103.8%]">돌리기</span>
          </UniqueText>
          <div className="relative mt-8 w-full max-w-[20rem]">
            <Image
              src="/hot-potato/bomb.png"
              alt="폭탄 돌리기 메인 일러스트"
              width={320}
              height={320}
              priority
              className="relative mx-auto w-full max-w-[16rem] animate-[float_4.2s_ease-in-out_infinite]"
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
      )}

      {!showIntro && (
        <div className="mx-auto max-w-xl rounded-2xl border border-chocolate/20 bg-white p-5 shadow-sm">
          <UniqueText Tag="h1" font="sans" size="lg" className="text-center text-chocolate">
            폭탄
            <br />
            <span className="text-[3.625rem] leading-[103.8%]">돌리기</span>
          </UniqueText>
          <p className="mt-2 text-center text-sm text-gray-500">상태: {statusText}</p>

          {!roomId && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              방을 만든 뒤 링크를 공유해 2인 이상 모이면 시작할 수 있습니다.
            </p>
          )}

          {errorBanner && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorBanner.message}
            </div>
          )}

          <section className="mt-5 rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">참가자</h2>
              <span className="text-xs text-gray-500">{effectivePlayers.length}명 참여 중</span>
            </div>

            <ul className="mt-3 space-y-2">
              {roomState.players.map(player => (
                <li
                  key={player.userId}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {player.nickname}
                      {player.userId === roomState.hostId ? ' (Host)' : ''}
                      {player.userId === clientActor ? ' (나)' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {player.isSpectator ? '관전' : player.isReady ? '준비 완료' : '준비 전'}
                    </p>
                  </div>
                  {player.userId === clientActor && roomState.game.status !== 'running' && (
                    <MainButton variant="outlined" color="chocolate" onClick={handleToggleReady}>
                      {player.isReady ? '준비 해제' : '준비'}
                    </MainButton>
                  )}
                </li>
              ))}
            </ul>

            {roomState.game.status !== 'running' && (
              <div className="mt-4 flex gap-2">
                <input
                  value={nicknameInput}
                  onChange={event => setNicknameInput(event.target.value)}
                  placeholder="닉네임 수정"
                  className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-chocolate"
                />
                <MainButton
                  variant="outlined"
                  color="chocolate"
                  onClick={handleSaveNickname}
                  className="flex-shrink-0"
                  fullWidth={false}
                >
                  닉네임 저장
                </MainButton>
              </div>
            )}
            {roomId && clientActor === roomState.hostId && roomState.game.status !== 'running' && (
              <div className="mt-4 rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-800">라운드 설정 (진행자)</p>
                <div className="mt-2 flex gap-2">
                  {DURATION_OPTIONS.map(option => {
                    const selected = roomState.game.config.durationSec === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => void handleConfigChange({ durationSec: option })}
                        className={`h-9 flex-1 rounded-full border text-sm font-semibold transition-colors ${
                          selected
                            ? 'border-chocolate bg-chocolate text-white'
                            : 'border-gray-300 bg-white text-gray-700'
                        }`}
                      >
                        {option}초
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={roomState.game.config.hostOnlyPass}
                    onChange={event => void handleConfigChange({ hostOnlyPass: event.target.checked })}
                  />
                  진행자만 &lsquo;다음 사람&rsquo; 누르기
                </label>
              </div>
            )}

            {roomState.game.status !== 'running' && (
              <div className="mt-4">
                <MainButton variant="contained" color="chocolate" disabled={!canStart.ok} onClick={handleStartGame}>
                  게임 시작
                </MainButton>
                {!canStart.ok && <p className="mt-2 text-xs text-amber-700">{canStart.message}</p>}
              </div>
            )}
          </section>

          {roomState.game.status === 'running' && (
            <section className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="mx-auto h-56 w-56">
                <Image
                  src="/hot-potato/bomb.png"
                  alt="Hot potato bomb character"
                  width={320}
                  height={320}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <p className="mt-2 text-center text-lg font-semibold text-gray-900">
                현재 소유자: {holderPlayer?.nickname ?? '알 수 없음'}
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>남은 시간</span>
                  <span>{(timerRemainingMs / 1000).toFixed(1)}s</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full bg-chocolate transition-[width] duration-100"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <MainButton variant="contained" color="chocolate" disabled={!canPass} onClick={handlePass}>
                  다음 사람
                </MainButton>
                {cooldownRemainingMs > 0 && (
                  <p className="text-sm text-gray-600">
                    잠시 후 다시 시도하세요 ({(cooldownRemainingMs / 1000).toFixed(1)}s)
                  </p>
                )}
              </div>
            </section>
          )}

          {roomState.game.status === 'ended' && (
            <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-center text-2xl font-bold text-emerald-700">
                당첨: {winnerPlayer?.nickname ?? '알 수 없음'} 🎉
              </p>
              {roomState.game.reason === 'insufficient_players' && (
                <>
                  <p className="mt-2 text-center text-sm text-red-700">인원이 부족해 게임이 종료되었습니다.</p>
                  <p className="text-center text-xs text-gray-600">다시하기는 2인 이상일 때 가능합니다.</p>
                </>
              )}
              {roomState.game.reason === 'timeout' && (
                <p className="mt-2 text-center text-sm text-gray-700">타이머 종료로 라운드가 끝났습니다.</p>
              )}

              {clientActor === roomState.hostId && (
                <div className="mt-4">
                  <MainButton variant="contained" color="chocolate" onClick={handleReset}>
                    다시하기
                  </MainButton>
                </div>
              )}
            </section>
          )}

          {roomState.game.history.length > 0 && roomState.game.status !== 'running' && (
            <section className="mt-5 rounded-xl border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-800">지난 라운드</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {[...roomState.game.history].reverse().map(entry => (
                  <li
                    key={`${entry.roundId}-${entry.endedAtMs}`}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <span className="text-gray-800">
                      {entry.roundId}라운드 · {nicknameByUserId.get(entry.winnerUserId ?? '') ?? '알 수 없음'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {entry.reason === 'insufficient_players' ? '인원 부족' : '타임아웃'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <RoomSharePanel
        gameType="hot_potato"
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
        lastActor={roomState.lastActor}
        roomName={roomInfo.name}
        maxCapacity={roomInfo.maxCapacity}
      />
    </div>
  );
}

export default function HotPotatoPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen" />}>
      <HotPotatoPageContent />
    </Suspense>
  );
}
