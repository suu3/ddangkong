import { describe, expect, it } from 'vitest';
import { assertTeamConfig } from './team-config';

describe('concurrent team configuration', () => {
  const original = { members: ['가', '나', '다'], teamCount: 2 };
  it('rejects a stale participant list instead of restoring removed names', () => {
    expect(() => assertTeamConfig({ ...original, members: ['가', '나'] }, original)).toThrow('STALE_REVISION');
  });
  it('rejects stale team counts before drawing results', () => {
    expect(() => assertTeamConfig({ ...original, teamCount: 3 }, original)).toThrow('STALE_REVISION');
  });
  it('allows unchanged configuration across unrelated state updates', () => {
    expect(() => assertTeamConfig({ ...original, members: [...original.members] }, original)).not.toThrow();
  });
});
