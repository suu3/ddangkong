export function parseNames(input: string): string[] {
  return input
    .split(/[,\r\n]+/)
    .map(name => name.trim())
    .filter(Boolean);
}

export function normalizeNames(names: string[]): string[] {
  const reserved = new Set(names.map(n => n.trim().toLowerCase()));
  const used = new Set<string>();
  return names
    .map(n => n.trim())
    .filter(Boolean)
    .map(name => {
      let label = name;
      let suffix = 2;
      while (used.has(label.toLowerCase()) || (label !== name && reserved.has(label.toLowerCase()))) {
        label = `${name} (${suffix++})`;
      }
      used.add(label.toLowerCase());
      return label;
    });
}

export function teamSizes(count: number, teams: number): number[] {
  if (!Number.isInteger(teams) || teams < 2 || teams > count) throw new Error('인원보다 팀 수가 많아요.');
  return Array.from({ length: teams }, (_, i) => Math.floor(count / teams) + (i < count % teams ? 1 : 0));
}

export function splitTeams(members: string[], count: number): string[][] {
  const sizes = teamSizes(members.length, count);
  const shuffled = [...members];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let offset = 0;
  return sizes.map(size => {
    const team = shuffled.slice(offset, offset + size);
    offset += size;
    return team;
  });
}
