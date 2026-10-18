import { describe, expect, it } from 'vitest';
import { parseClientEvent } from './realtime-protocol';

describe('realtime protocol boundary', () => {
  it('accepts authentication and refuses unsupported versions', () => {
    expect(parseClientEvent({ v: 1, type: 'authenticate', token: 'a'.repeat(64) }).type).toBe('authenticate');
    expect(() => parseClientEvent({ v: 2, type: 'authenticate' })).toThrow('UNSUPPORTED_PROTOCOL');
  });
  it('rejects missing revisions and unbounded presence data', () => {
    expect(() => parseClientEvent({ v: 1, type: 'state_update', requestId: 'a', state: {} })).toThrow();
    expect(() =>
      parseClientEvent({ v: 1, type: 'presence_update', requestId: 'a', presence: { cardIndex: -1 } })
    ).toThrow();
  });
});
