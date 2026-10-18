import { describe, expect, it } from 'vitest';
import { applyCommand, validateState, authorizeStateUpdate } from '../src/authorization';

const state = { revision: 0, lastActor: null, step: 2, orderState: { total: 4, boom: 1 }, result: null };
describe('game authority', () => {
  it('never passes a bomb to an offline player from the historical roster', () => {
    const hot = {
      revision: 0,
      lastActor: null,
      hostId: 'anon-host1234',
      players: ['anon-host1234', 'anon-member123', 'anon-offline123'].map(userId => ({ userId, isSpectator: false })),
      game: {
        status: 'running',
        holderUserId: 'anon-host1234',
        endsAtMs: 5000,
        lastPassAtMs: 0,
        lastHolders: ['anon-member123', 'anon-host1234'],
        config: { cooldownMs: 800, hostOnlyPass: false, allowSelfPass: false, antiRepeatWindow: 2 },
      },
    };
    const next = applyCommand(
      'hot_potato',
      hot,
      'anon-host1234',
      { kind: 'hot_potato.pass' },
      1000,
      10,
      new Set(['anon-host1234', 'anon-member123'])
    ) as any;
    expect(next.game.holderUserId).toBe('anon-member123');
  });
  it('prevents members replacing shared state', () => {
    expect(() => authorizeStateUpdate('member')).toThrow('HOST_PERMISSION_REQUIRED');
  });
  it('changes only the authenticated coffee actor selection', () => {
    const next = applyCommand('coffee', state, 'anon-member123', { kind: 'coffee.select', cardIndex: 2 }, 1000, 10);
    expect(next).toEqual({ ...state, selections: { 'anon-member123': 2 } });
    expect(() =>
      applyCommand('coffee', state, 'anon-member123', { kind: 'coffee.select', cardIndex: 5 }, 1000, 10)
    ).toThrow();
    expect(
      (applyCommand('coffee', state, 'anon-member123', { kind: 'coffee.select', cardIndex: 4 }, 1000, 10) as any)
        .selections['anon-member123']
    ).toBe(4);
    expect(() =>
      applyCommand('coffee', state, 'anon-member123', { kind: 'coffee.select', cardIndex: 0 }, 1000, 10)
    ).toThrow();
  });
  it('rejects malformed game payloads and out-of-range roulette results', () => {
    expect(() => validateState('roulette', { revision: 0 })).toThrow();
    expect(() =>
      validateState('roulette', {
        revision: 0,
        lastActor: null,
        step: 2,
        orderState: { angle: 0, total: ['a'] },
        resultIndex: 4,
      })
    ).toThrow();
  });
  it('allows only the current holder to pass, using server time and eligible players', () => {
    const hot = {
      revision: 0,
      lastActor: null,
      hostId: 'anon-host1234',
      players: [
        { userId: 'anon-host1234', nickname: '가', isReady: true, isSpectator: false },
        { userId: 'anon-member123', nickname: '나', isReady: true, isSpectator: false },
      ],
      game: {
        status: 'running',
        holderUserId: 'anon-host1234',
        endsAtMs: 5000,
        lastPassAtMs: 0,
        lastHolders: ['anon-host1234'],
        config: { cooldownMs: 800, hostOnlyPass: false, allowSelfPass: false, antiRepeatWindow: 2 },
      },
    };
    expect(() => applyCommand('hot_potato', hot, 'anon-member123', { kind: 'hot_potato.pass' }, 1000, 10)).toThrow(
      'MUTATION_NOT_ALLOWED'
    );
    const next = applyCommand('hot_potato', hot, 'anon-host1234', { kind: 'hot_potato.pass' }, 1000, 10) as any;
    expect(next.game.holderUserId).toBe('anon-member123');
    expect(next.game.lastPassAtMs).toBe(1000);
    expect(() => applyCommand('hot_potato', next, 'anon-member123', { kind: 'hot_potato.pass' }, 1100, 10)).toThrow(
      'COOLDOWN'
    );
  });
});
