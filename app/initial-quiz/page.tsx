'use client';
import { useEffect, useRef, useState } from 'react';
import UniqueText from '@/components/UniqueText';
import MainButton from '@/components/button/MainButton';
import ResultMoment from '@/components/ResultMoment';
import {
  advanceQuiz,
  createQuiz,
  initials,
  quizDeck,
  type QuizCategory,
  type QuizEvent,
  type QuizState,
} from '@/src/shared/lib/initial-quiz';
import styles from './quiz.module.css';
const categories: { value: QuizCategory; label: string }[] = [
  { value: 'mixed', label: '모두 섞기' },
  { value: 'food', label: '음식' },
  { value: 'animals', label: '동물' },
  { value: 'life', label: '생활' },
];
export default function InitialQuizPage() {
  const [category, setCategory] = useState<QuizCategory>('mixed');
  const [teams, setTeams] = useState(2);
  const [duration, setDuration] = useState(60);
  const [names, setNames] = useState(['A팀', 'B팀', 'C팀', 'D팀']);
  const [game, setGame] = useState<QuizState | null>(null);
  const [clock, setClock] = useState(0);
  const [feedback, setFeedback] = useState<{ id: number; text: string } | null>(null);
  const lastAction = useRef(0);
  const phase = game?.phase;
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = () => {
      const now = Date.now();
      setClock(now);
      setGame(current => (current ? advanceQuiz(current, { type: 'tick', now }) : current));
    };
    tick();
    const timer = window.setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase]);
  const name = (team: number) => names[team].trim() || `${String.fromCharCode(65 + team)}팀`;
  const send = (type: QuizEvent['type']) => {
    const now = Date.now();
    if ((type === 'correct' || type === 'pass') && now - lastAction.current < 300) return;
    if (type === 'correct' || type === 'pass') lastAction.current = now;
    else if (type === 'start') lastAction.current = 0;
    setClock(now);
    if (type === 'correct' || type === 'pass')
      setFeedback({ id: now, text: type === 'correct' ? '+1 정답!' : '다음 문제!' });
    else setFeedback(null);
    setGame(current => (current ? advanceQuiz(current, { type, now }) : current));
  };
  const setup = () => {
    setGame(createQuiz(teams, duration, quizDeck(category)));
    setFeedback(null);
  };
  const remaining = game ? Math.max(0, Math.ceil((game.deadline - clock) / 1000)) : 0;
  const word = game?.decks[game.team][game.card] ?? '';
  const maxScore = game ? Math.max(...game.scores) : 0;
  return (
    <div className={styles.page}>
      <p className={styles.kicker}>같이 맞히고, 같이 웃는</p>
      <UniqueText Tag="h1" font="sans" size="lg" className="text-center">
        입이 근질근질
        <br />
        <span className="text-[3rem]">초성 퀴즈</span>
      </UniqueText>
      {!game ? (
        <section className={styles.setup}>
          <h2>오늘은 어떤 주제?</h2>
          <div className={styles.choices}>
            {categories.map(item => (
              <button key={item.value} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
          <h2>팀 수</h2>
          <div className={styles.choices}>
            {[2, 3, 4].map(count => (
              <button key={count} aria-pressed={teams === count} onClick={() => setTeams(count)}>
                {count}팀
              </button>
            ))}
          </div>
          <div className={styles.teamNames}>
            {names.slice(0, teams).map((value, index) => (
              <label key={index}>
                {String.fromCharCode(65 + index)}팀 이름
                <input
                  maxLength={12}
                  value={value}
                  onChange={e => setNames(current => current.map((n, i) => (i === index ? e.target.value : n)))}
                />
              </label>
            ))}
          </div>
          <h2>팀마다 제한 시간</h2>
          <div className={styles.choices}>
            {[30, 60, 90].map(seconds => (
              <button key={seconds} aria-pressed={duration === seconds} onClick={() => setDuration(seconds)}>
                {seconds}초
              </button>
            ))}
          </div>
          <ol className={styles.rules}>
            <li>진행자 한 명이 폰을 들고 초성을 보여주세요.</li>
            <li>팀원이 말로 정답을 맞히면 ‘맞혔어요’를 눌러 1점!</li>
            <li>모르면 패스. 모두 한 번씩 도전한 뒤 점수를 비교해요.</li>
          </ol>
          <p className={styles.note}>
            각 팀에는 서로 다른 문제가 나와요. 준비된 정답이 기준이며, 정답 인정 범위는 시작 전에 정해주세요.
          </p>
          <MainButton onClick={setup}>팀 대결 준비</MainButton>
        </section>
      ) : game.phase === 'ready' ? (
        <section className={styles.handoff}>
          <p className={styles.roundLabel}>
            {game.team + 1} / {teams}번째 도전
          </p>
          <h2>{name(game.team)} 준비됐나요?</h2>
          <div className={styles.readyInitials} aria-hidden="true">
            ㄱ ㄱ!
          </div>
          <p>
            {duration}초 동안 최대한 많이 맞혀보세요.
            <br />
            준비된 문제를 모두 풀어도 라운드가 끝나요.
          </p>
          <MainButton onClick={() => send('start')}>준비 완료, 시작!</MainButton>
          <button className={styles.textButton} onClick={() => setGame(null)}>
            설정으로 돌아가기
          </button>
        </section>
      ) : game.phase === 'playing' ? (
        <section className={styles.play}>
          <div className={styles.roundHeading}>
            <strong>{name(game.team)}</strong>
            <span>{game.scores[game.team]}점</span>
            <span className={styles.timer} data-urgent={remaining <= 10} aria-label={`남은 시간 ${remaining}초`}>
              {remaining}
              <small>초</small>
            </span>
          </div>
          <div className={styles.timerTrack} aria-hidden="true">
            <div style={{ transform: `scaleX(${remaining / duration})` }} />
          </div>
          <div key={`${game.team}-${game.card}`} className={styles.question}>
            <p className={styles.roundLabel}>
              {game.card + 1}번째 문제 · {categories.find(c => c.value === category)?.label}
            </p>
            <p className={styles.initials} aria-label={`초성 ${initials(word)}`}>
              {initials(word)}
            </p>
            {game.revealed ? (
              <p className={styles.answer} role="status">
                {word}
              </p>
            ) : (
              <button className={styles.revealButton} onClick={() => send('reveal')}>
                정답 살짝 보기
              </button>
            )}
          </div>
          {feedback && (
            <p key={feedback.id} className={styles.feedback} role="status">
              {feedback.text}
            </p>
          )}
          <div className={styles.playActions}>
            <MainButton variant="outlined" onClick={() => send('pass')}>
              패스
            </MainButton>
            <MainButton onClick={() => send('correct')}>맞혔어요 +1</MainButton>
          </div>
          <p className={styles.note}>정답 확인만으로 점수가 오르지 않아요. 진행자가 맞혔는지 판단해주세요.</p>
        </section>
      ) : game.phase === 'between' ? (
        <section className={styles.handoff}>
          <ResultMoment label="이번 팀의 도전 완료!">
            <h2>{name(game.team)}</h2>
            <p className={styles.score}>
              {game.scores[game.team]}
              <small>점</small>
            </p>
          </ResultMoment>
          <p className={styles.note}>
            {game.card >= game.decks[game.team].length ? '준비된 문제를 모두 풀었어요.' : '제한 시간이 끝났어요.'} 다음
            팀에게 차례를 넘겨주세요.
          </p>
          <MainButton onClick={() => send('next')}>{name(game.team + 1)} 준비하기</MainButton>
        </section>
      ) : (
        <section className={styles.handoff}>
          <ResultMoment label="오늘의 초성 챔피언">
            <h2>
              {game.scores
                .map((score, index) => (score === maxScore ? name(index) : null))
                .filter(Boolean)
                .join(' · ')}
            </h2>
            <p className={styles.score}>
              {maxScore}
              <small>점</small>
            </p>
            {game.scores.filter(s => s === maxScore).length > 1 && <p>공동 우승!</p>}
          </ResultMoment>
          <ol className={styles.scoreboard}>
            {game.scores
              .map((score, index) => ({ score, index }))
              .sort((a, b) => b.score - a.score)
              .map(({ score, index }) => (
                <li key={index}>
                  <span>{name(index)}</span>
                  <strong>{score}점</strong>
                </li>
              ))}
          </ol>
          <MainButton onClick={setup}>새 문제로 한 판 더</MainButton>
          <button className={styles.textButton} onClick={() => setGame(null)}>
            주제·시간 바꾸기
          </button>
        </section>
      )}
    </div>
  );
}
