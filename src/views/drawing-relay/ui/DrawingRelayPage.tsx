'use client';
import { Suspense } from 'react';
import Image from 'next/image';
import UniqueText from '@/components/UniqueText';
import MainButton from '@/components/button/MainButton';
import { RoomSharePanel } from '@/src/widgets/room-share';
import { roomErrorMessage } from '@/src/entities/room';
import { entryKind, roundDurationMs } from '@/src/shared/lib/drawing-relay';
import { useDrawingRelayView } from '../model/useDrawingRelayView';
import DrawingCanvas from './DrawingCanvas';
import RelayResults from './RelayResults';
import styles from './drawing-relay.module.css';
function Title() {
  return (
    <UniqueText Tag="h1" font="sans" size="lg" className="text-center">
      낙서
      <br />
      <span className={styles.titleBottom}>이어달리기</span>
    </UniqueText>
  );
}
function Content() {
  const v = useDrawingRelayView();
  const { live, state } = v;
  const connected = live.status === 'connected';
  const playable = connected && !v.busy;
  const playing = state?.phase === 'playing';
  const isText = entryKind(state?.round ?? 0) === 'text';
  const showIntro = !v.roomId && !v.entered;
  return (
    <div className={styles.page}>
      {showIntro ? (
        <section className={styles.intro}>
          <Title />
          <Image
            src="/logos/games/drawing-relay.svg"
            width={272}
            height={272}
            alt="연필과 낙서 종이"
            priority
            className={styles.introImage}
          />
          <p className={styles.hint}>그림으로 전하고, 엉뚱하게 받아 적어요!</p>
          <p className={styles.hint}>친구 4~10명 · 각자 휴대폰으로 함께</p>
          <div className="mt-8 w-full max-w-[15rem]">
            <MainButton onClick={() => v.setEntered(true)}>시작하기</MainButton>
          </div>
        </section>
      ) : (
        <div className={styles.card}>
          <Title />
          {!v.roomId && (
            <p className={styles.notice}>방을 만들고 링크를 공유해 주세요. 친구들과 문장과 그림을 번갈아 전해요.</p>
          )}
          {!v.configured && (
            <p role="status" className={styles.notice}>
              지금은 함께하는 방을 사용할 수 없어요. 잠시 후 다시 찾아 주세요.
            </p>
          )}
          {v.error && (
            <p role="alert" className={styles.notice}>
              {v.error}
            </p>
          )}
          {v.roomId && !connected && (
            <div role="status" className={styles.notice}>
              {live.status === 'expired'
                ? '방이 만료됐어요. 새 방을 만들어 주세요.'
                : live.error
                  ? roomErrorMessage(live.error)
                  : '친구들과 다시 연결하고 있어요…'}
              {(live.status === 'error' || live.status === 'reconnecting') && (
                <MainButton variant="outlined" onClick={live.retry}>
                  다시 연결
                </MainButton>
              )}
            </div>
          )}
          {v.roomId && connected && state && state.phase === 'lobby' && (
            <>
              <section className={styles.section}>
                <div className={styles.heading}>
                  <h2>함께 그릴 친구들</h2>
                  <span className="text-sm">{state.players.length}/10명</span>
                </div>
                <ul className={styles.members}>
                  {state.players.map(p => (
                    <li key={p.actorId}>
                      <span>
                        {p.nickname}
                        <small>
                          {p.actorId === state.hostId ? '방장 ' : ''}
                          {p.actorId === live.actorId ? '나' : ''}
                        </small>
                      </span>
                      <span>{p.ready ? '준비 완료' : '준비 중'}</span>
                    </li>
                  ))}
                </ul>
                <label className="mb-2 block text-sm" htmlFor="relay-nickname">
                  닉네임
                </label>
                <input
                  id="relay-nickname"
                  className={styles.field}
                  value={v.nickname}
                  onChange={e => v.setNickname(e.target.value)}
                  maxLength={20}
                  placeholder="친구들에게 보여줄 이름"
                  autoComplete="nickname"
                />
                <div className={styles.actions}>
                  <MainButton
                    variant="outlined"
                    disabled={!playable || !v.nickname.trim()}
                    onClick={() => void v.perform({ kind: v.me ? 'rename' : 'join', nickname: v.nickname })}
                  >
                    {v.me ? '닉네임 저장' : '참가하기'}
                  </MainButton>
                  {v.me && (
                    <MainButton
                      variant={v.me.ready ? 'outlined' : 'contained'}
                      disabled={!playable}
                      onClick={() => void v.perform({ kind: 'ready', ready: !v.me!.ready })}
                    >
                      {v.me.ready ? '준비 해제' : '준비 완료'}
                    </MainButton>
                  )}
                </div>
                <p className={styles.hint}>
                  4명 이상 모두 준비되면 시작할 수 있어요.
                  <br />
                  문장 30초 · 그림 60초 · 점수 없이 즐겨요.
                </p>
                {live.isHost && (
                  <div className={styles.actions}>
                    <MainButton
                      disabled={!playable || state.players.length < 4 || !state.players.every(p => p.ready)}
                      onClick={() => void v.perform({ kind: 'start' })}
                    >
                      게임 시작
                    </MainButton>
                  </div>
                )}
              </section>
            </>
          )}
          {v.roomId && connected && state && playing && (
            <section className={`${styles.section} ${styles.playSection}`}>
              <div className={styles.heading}>
                <h2>
                  {state.round + 1}/{state.order.length} · {isText ? '문장 차례' : '그림 차례'}
                </h2>
                <span className={styles.timer} role="timer" aria-label="남은 시간">
                  {Math.ceil(v.remainingMs / 1000)}초
                </span>
              </div>
              <progress
                className={styles.progress}
                max={roundDurationMs(state.round)}
                value={v.remainingMs}
                aria-label="남은 시간 비율"
              />
              <p className={styles.hint}>
                {state.submitted.length}/{state.order.length}명 전달 완료
              </p>
              {state.ownSubmitted ? (
                <div className={styles.waiting}>
                  <UniqueText Tag="h2" size="ml">
                    잘 전달했어요!
                  </UniqueText>
                  <p className={styles.hint}>친구들의 낙서를 기다리고 있어요.</p>
                </div>
              ) : (
                <>
                  <p className={styles.hint}>
                    {state.round === 0
                      ? '처음 이야기를 적어 주세요.'
                      : isText
                        ? '이 그림은 무슨 이야기일까요?'
                        : '받은 문장을 그림으로 표현해 주세요.'}
                  </p>
                  {state.previousEntry?.kind === 'text' && (
                    <p className={styles.prompt}>
                      {state.previousEntry.text || '전달된 문장이 없어요. 자유롭게 그려 주세요!'}
                    </p>
                  )}
                  {state.previousEntry?.kind === 'drawing' && (
                    <div className="my-4">
                      <DrawingCanvas readOnly value={state.previousEntry.drawing} />
                      {!state.previousEntry.drawing.strokes.length && (
                        <p className={styles.hint}>빈 종이가 왔어요. 상상해서 적어 주세요!</p>
                      )}
                    </div>
                  )}
                  {isText ? (
                    <>
                      <label className="sr-only" htmlFor="relay-sentence">
                        전달할 문장
                      </label>
                      <textarea
                        id="relay-sentence"
                        className={`${styles.field} mt-3`}
                        rows={3}
                        maxLength={100}
                        value={typeof v.draft === 'string' ? v.draft : ''}
                        onChange={e => v.setDraft(e.target.value)}
                        placeholder={
                          state.round === 0
                            ? '예: 고양이가 회사에서 면접을 본다'
                            : '그림을 보고 떠오른 이야기를 적어 주세요'
                        }
                      />
                      <p className="mt-1 text-right text-xs text-milkChocolate">
                        {typeof v.draft === 'string' ? v.draft.length : 0}/100
                      </p>
                    </>
                  ) : (
                    <DrawingCanvas
                      key={v.storageKey}
                      value={typeof v.draft === 'string' ? { strokes: [] } : v.draft}
                      onChange={v.setDraft}
                      disabled={!playable || v.remainingMs === 0}
                    />
                  )}
                  <div className={styles.actions}>
                    <MainButton disabled={!playable || v.remainingMs === 0} onClick={() => void v.submit()}>
                      {isText ? '문장 전달하기' : '그림 전달하기'}
                    </MainButton>
                  </div>
                  <p className={styles.hint}>시간이 끝나면 저장된 내용으로 전달돼요.</p>
                </>
              )}
            </section>
          )}
          {state && connected && (state.phase === 'reveal' || state.phase === 'complete') && (
            <RelayResults
              state={state}
              isHost={live.isHost}
              busy={v.busy}
              onRevealNext={() => void v.perform({ kind: 'reveal-next' })}
              onReset={() => void v.perform({ kind: 'reset' })}
            />
          )}
        </div>
      )}
      <RoomSharePanel
        gameType="drawing_relay"
        roomId={v.roomId}
        localActor={live.actorId}
        hasConfig={v.configured}
        presenceActors={live.members.map(m => m.actorId)}
        connectionStatus={live.status}
        connectionError={roomErrorMessage(live.error)}
        expiresAt={live.room?.expiresAt}
        onRetry={live.retry}
        preferFloatingEntry
        onCreateRoom={v.handleCreateRoom}
        lastActor={state?.lastActor}
        roomName={live.room?.name}
        maxCapacity={10}
      />
    </div>
  );
}
export default function DrawingRelayPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8 text-center">
          종이를 준비하고 있어요…
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
