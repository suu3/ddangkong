import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials, createQuiz, advanceQuiz, QUIZ_WORDS } from '../src/shared/lib/initial-quiz.ts';
test('Hangul initials preserve spaces and reject accidental non-Hangul data', () => {
  assert.equal(initials('김치 볶음밥'), 'ㄱㅊ ㅂㅇㅂ');
  for (const words of Object.values(QUIZ_WORDS)) {
    assert.equal(new Set(words).size, words.length);
    assert(words.length >= 20);
    for (const word of words) assert.match(word, /^[가-힣 ]+$/);
  }
});
test('revealing and passing never score; expired answers cannot score', () => {
  let state = createQuiz(2, 30, ['사과', '바나나', '포도', '딸기', '수박', '망고']);
  state = advanceQuiz(state, { type: 'start', now: 1000 });
  state = advanceQuiz(state, { type: 'reveal', now: 1001 });
  assert.equal(state.revealed, true);
  assert.deepEqual(state.scores, [0, 0]);
  state = advanceQuiz(state, { type: 'pass', now: 1002 });
  assert.equal(state.card, 1);
  assert.equal(state.revealed, false);
  state = advanceQuiz(state, { type: 'correct', now: 1003 });
  assert.deepEqual(state.scores, [1, 0]);
  state = advanceQuiz(state, { type: 'correct', now: 31000 });
  assert.deepEqual(state.scores, [1, 0]);
  assert.equal(state.phase, 'between');
});
test('each team gets a fresh round and final scoreboard stays stable', () => {
  let state = createQuiz(2, 30, ['사과', '바나나']);
  state = advanceQuiz(state, { type: 'start', now: 0 });
  state = advanceQuiz(state, { type: 'correct', now: 1 });
  state = advanceQuiz(state, { type: 'tick', now: 30000 });
  state = advanceQuiz(state, { type: 'next', now: 30001 });
  assert.equal(state.team, 1);
  assert.equal(state.phase, 'ready');
  state = advanceQuiz(state, { type: 'start', now: 40000 });
  state = advanceQuiz(state, { type: 'tick', now: 70000 });
  assert.equal(state.phase, 'finished');
  assert.deepEqual(state.scores, [1, 0]);
  assert.deepEqual(advanceQuiz(state, { type: 'correct', now: 70001 }), state);
});
test('exhausted deck ends round without repeating cards', () => {
  let state = advanceQuiz(createQuiz(2, 30, ['사과', '바나나']), { type: 'start', now: 0 });
  state = advanceQuiz(state, { type: 'correct', now: 1 });
  assert.equal(state.phase, 'between');
  assert.equal(state.scores[0], 1);
  assert.throws(() => createQuiz(1, 30, ['사과']));
});

test('team decks never overlap within one match', () => {
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`);
  const state = createQuiz(4, 60, words);
  assert.deepEqual(
    state.decks.map(deck => deck.length),
    [15, 15, 15, 15]
  );
  assert.equal(new Set(state.decks.flat()).size, 60);
});
