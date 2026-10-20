interface TeamConfig {
  members: readonly string[];
  teamCount: number;
}

// A retry must not apply a draw or edit based on a different visible configuration.
export function assertTeamConfig(current: TeamConfig, expected: TeamConfig): void {
  if (
    current.teamCount !== expected.teamCount ||
    current.members.length !== expected.members.length ||
    current.members.some((name, index) => name !== expected.members[index])
  ) {
    throw new Error('STALE_REVISION');
  }
}
