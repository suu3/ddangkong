'use client';
import { useEffect, useRef, useState } from 'react';
import UniqueText from '@/components/UniqueText';
import MainButton from '@/components/button/MainButton';
import ResultMoment from '@/components/ResultMoment';
import { normalizeNames } from '@/src/shared/lib/party-members';
import {
  createLadder,
  traceLadder,
  railX,
  rowY,
  ladderWidth,
  LADDER_TOP,
  LADDER_BOTTOM,
  type Ladder,
} from '@/src/shared/lib/ladder';
import styles from './ladder.module.css';
type Entry = { name: string; outcome: string };
type Round = { entries: Entry[]; ladder: Ladder };
export default function LadderPage() {
  const [entries, setEntries] = useState<Entry[]>([
    { name: '', outcome: '' },
    { name: '', outcome: '' },
  ]);
  const [round, setRound] = useState<Round | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [tracing, setTracing] = useState(false);
  const [error, setError] = useState('');
  const boardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!tracing) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1700;
    const timer = window.setTimeout(() => {
      if (selected !== null) setRevealed(current => (current.includes(selected) ? current : [...current, selected]));
      setTracing(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [tracing, selected]);
  useEffect(() => {
    if (round) boardRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [round]);
  const start = () => {
    if (entries.some(e => !e.name.trim() || !e.outcome.trim())) {
      setError('모든 이름과 결과를 입력해주세요.');
      return;
    }
    const names = normalizeNames(entries.map(e => e.name));
    const outcomes = entries.map(e => e.outcome.trim());
    for (let i = outcomes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
    }
    setRound({
      entries: names.map((name, i) => ({ name, outcome: outcomes[i] })),
      ladder: createLadder(entries.length),
    });
    setSelected(null);
    setRevealed([]);
    setTracing(false);
    setError('');
  };
  const activePath = round && selected !== null ? traceLadder(round.ladder, selected) : null;
  const update = (index: number, field: keyof Entry, value: string) =>
    setEntries(current => current.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  return (
    <div className={styles.page}>
      <p className={styles.kicker}>한 줄의 운명, 끝까지 가봐야 알아요</p>
      <UniqueText Tag="h1" font="sans" size="lg" className="text-center">
        두근두근
        <br />
        <span className="text-[3rem]">사다리 타기</span>
      </UniqueText>
      {!round ? (
        <>
          <section className={styles.setup}>
            <div className={styles.sectionHeading}>
              <h2>함께할 사람과 결과</h2>
              <span>{entries.length}명 / 최대 8명</span>
            </div>
            <p className={styles.help}>이름과 결과를 같은 수로 적어주세요. 결과의 위치는 시작할 때 섞여요.</p>
            <div className={styles.columnLabels} aria-hidden="true">
              <span>이름</span>
              <span>결과 / 벌칙</span>
              <span />
            </div>
            {entries.map((entry, index) => (
              <div className={styles.entry} key={index}>
                <input
                  aria-label={`${index + 1}번 이름`}
                  maxLength={24}
                  placeholder={`참여자 ${index + 1}`}
                  value={entry.name}
                  onChange={e => update(index, 'name', e.target.value)}
                />
                <input
                  aria-label={`${index + 1}번 결과`}
                  maxLength={40}
                  placeholder={index === 0 ? '커피 사기' : '통과'}
                  value={entry.outcome}
                  onChange={e => update(index, 'outcome', e.target.value)}
                />
                <button
                  type="button"
                  disabled={entries.length <= 2}
                  aria-label={`${index + 1}번 참여자 삭제`}
                  onClick={() => setEntries(current => current.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.add}
              disabled={entries.length >= 8}
              onClick={() => setEntries(current => [...current, { name: '', outcome: '' }])}
            >
              + 참여자 추가
            </button>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <MainButton className="mt-5" onClick={start}>
              사다리 만들기
            </MainButton>
          </section>
          <p className={styles.footnote}>2~8명 · 한 기기에서 함께 플레이 · 이름과 결과는 서버에 저장하지 않아요</p>
        </>
      ) : (
        <section ref={boardRef} className={styles.boardSection}>
          <h2 className={styles.boardTitle}>누구의 운명부터 볼까요?</h2>
          <p className={styles.help}>
            이름을 누르면 사다리를 따라 결과가 공개돼요.
            {round.entries.length > 3 && ' 옆으로 밀어 모든 이름을 확인하세요.'}
          </p>
          <div
            className={styles.boardScroll}
            tabIndex={0}
            role="region"
            aria-label="사다리 게임판. 좌우로 스크롤할 수 있습니다."
          >
            <div className={styles.boardInner} style={{ width: ladderWidth(round.entries.length) }}>
              <div
                className={styles.railLabels}
                style={{ gridTemplateColumns: `repeat(${round.entries.length}, 88px)` }}
              >
                {round.entries.map((entry, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={selected === index}
                    disabled={tracing}
                    onClick={() => {
                      setSelected(index);
                      setTracing(!revealed.includes(index));
                    }}
                  >
                    {entry.name}
                    {revealed.includes(index) && <span className={styles.checked}> ✓</span>}
                  </button>
                ))}
              </div>
              <svg
                viewBox={`0 0 ${ladderWidth(round.entries.length)} 368`}
                width={ladderWidth(round.entries.length)}
                height="368"
                aria-hidden="true"
                className={styles.ladder}
              >
                {round.entries.map((_, index) => (
                  <line key={index} x1={railX(index)} x2={railX(index)} y1={LADDER_TOP} y2={LADDER_BOTTOM} />
                ))}
                {(selected !== null || revealed.length > 0) &&
                  round.ladder.rows.flatMap((row, r) =>
                    row.map(rail => (
                      <line
                        key={`${r}-${rail}`}
                        x1={railX(rail)}
                        x2={railX(rail + 1)}
                        y1={rowY(r, round.ladder.rows.length)}
                        y2={rowY(r, round.ladder.rows.length)}
                      />
                    ))
                  )}
                {activePath && (
                  <g key={selected}>
                    <polyline
                      points={activePath.points.map(p => `${p.x},${p.y}`).join(' ')}
                      className={styles.path}
                      pathLength="1"
                    />
                    {tracing && (
                      <circle r="6" className={styles.traveler}>
                        <animateMotion
                          dur="1.6s"
                          fill="freeze"
                          path={`M ${activePath.points.map(p => `${p.x},${p.y}`).join(' L ')}`}
                        />
                      </circle>
                    )}
                  </g>
                )}
              </svg>
              <div
                className={styles.railLabels}
                style={{ gridTemplateColumns: `repeat(${round.entries.length}, 88px)` }}
              >
                {round.entries.map((entry, index) => (
                  <span
                    key={index}
                    className={`${styles.destination} ${!tracing && activePath?.end === index ? styles.arrived : ''}`}
                  >
                    {revealed.some(start => traceLadder(round.ladder, start).end === index) ? entry.outcome : '?'}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4" aria-live="polite">
            {tracing ? (
              <p className={styles.help}>사다리를 따라가는 중…</p>
            ) : activePath && selected !== null && revealed.includes(selected) ? (
              <ResultMoment key={selected} label="사다리의 끝에서 만난 운명">
                <p className="text-sm">{round.entries[selected].name}</p>
                <p className="mt-2 text-xl font-bold">{round.entries[activePath.end].outcome}</p>
              </ResultMoment>
            ) : null}
          </div>
          <div className={styles.actions}>
            <MainButton
              variant="outlined"
              disabled={tracing}
              onClick={() => setRevealed(round.entries.map((_, i) => i))}
            >
              전체 결과 보기
            </MainButton>
            <MainButton disabled={tracing} onClick={start}>
              다시 섞기
            </MainButton>
          </div>
          {revealed.length > 0 && (
            <ul className={styles.results} aria-label="공개된 사다리 결과">
              {round.entries.map((entry, index) =>
                revealed.includes(index) ? (
                  <li key={index}>
                    <span>{entry.name}</span>
                    <strong>{round.entries[traceLadder(round.ladder, index).end].outcome}</strong>
                  </li>
                ) : null
              )}
            </ul>
          )}
          <button
            type="button"
            className={styles.edit}
            disabled={tracing}
            onClick={() => {
              setRound(null);
              setSelected(null);
              setRevealed([]);
            }}
          >
            이름·결과 수정하기
          </button>
        </section>
      )}
    </div>
  );
}
