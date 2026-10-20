import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNames, normalizeNames, teamSizes, splitTeams } from '../src/shared/lib/party-members.ts';
import { createLadder, traceLadder } from '../src/shared/lib/ladder.ts';

test('pasted names support commas and newlines, but retain spaces', () => {
  assert.deepEqual(parseNames(' 김 민지,현우\n\n유진\r\n'), ['김 민지', '현우', '유진']);
});
test('duplicate labels remain unique and normalization is stable', () => {
  const names = normalizeNames(['민지', '민지', '민지 (2)', 'MIN', 'min']);
  assert.equal(new Set(names.map(n => n.toLowerCase())).size, 5);
  assert.deepEqual(normalizeNames(names), names);
});
test('teams preserve all members and differ by at most one', () => {
  const members = Array.from({ length: 7 }, (_, i) => `사람${i}`);
  const teams = splitTeams(members, 3);
  assert.deepEqual(
    teams.map(t => t.length),
    [3, 2, 2]
  );
  assert.deepEqual(teams.flat().sort(), members.sort());
  assert.deepEqual(teamSizes(7, 2), [4, 3]);
  assert.throws(() => splitTeams(['A', 'B'], 3));
});
test('every ladder is a bijection and paths end on the mapped rail', () => {
  for (let count = 2; count <= 8; count++) {
    for (let trial = 0; trial < 40; trial++) {
      const ladder = createLadder(count);
      const ends = Array.from({ length: count }, (_, i) => traceLadder(ladder, i).end);
      assert.deepEqual(
        [...ends].sort((a, b) => a - b),
        Array.from({ length: count }, (_, i) => i)
      );
      for (const row of ladder.rows) for (let i = 1; i < row.length; i++) assert.notEqual(row[i] - row[i - 1], 1);
    }
  }
});
test('trace follows known bridges and rejects invalid rails', () => {
  const ladder = { count: 3, rows: [[0], [1], [0]] };
  assert.equal(traceLadder(ladder, 0).end, 2);
  assert.throws(() => traceLadder(ladder, 3));
  assert.throws(() => createLadder(1));
});
