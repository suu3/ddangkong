import { describe, expect, it } from 'vitest';
import { rouletteResult } from './roulette-result';
describe('concurrent roulette result', () => {
  it('preserves the first committed result when a second tab retries', () => {
    expect(rouletteResult({ step: 2, resultIndex: 1, orderState: { total: ['가', '나'] } }, () => 0)).toBe(1);
  });
  it('does not draw a delayed result after returning to setup', () => {
    expect(rouletteResult({ step: 1, resultIndex: null, orderState: { total: ['가'] } })).toBeNull();
  });
  it('only draws for a populated active wheel', () => {
    expect(rouletteResult({ step: 2, resultIndex: null, orderState: { total: ['가', '나'] } }, () => 0.75)).toBe(1);
    expect(rouletteResult({ step: 2, resultIndex: null, orderState: { total: [] } })).toBeNull();
  });
});
