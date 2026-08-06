/**
 * 익명 actorId(`anon-xxxxxxxxxxxx`)를 사람이 읽기 쉬운 별칭(`유저1`, `유저2`...)으로 바꿉니다.
 *
 * actorId를 정렬한 순서로 번호를 매기기 때문에, 같은 참가자 집합을 보고 있는 클라이언트끼리는
 * 항상 같은 별칭을 계산합니다. (참가자가 들어오고 나가면 번호는 다시 매겨질 수 있습니다.)
 */
export const buildActorAliasMap = (actorIds: string[]): Map<string, string> => {
  const unique = Array.from(new Set(actorIds.filter(actorId => actorId && actorId !== 'guest')));
  unique.sort((a, b) => a.localeCompare(b));

  return new Map(unique.map((actorId, index) => [actorId, `유저${index + 1}`]));
};

export const getActorAlias = (
  actorId: string | null | undefined,
  aliasMap: Map<string, string>,
  selfActorId?: string
) => {
  if (!actorId || actorId === 'guest') return '-';

  const alias = aliasMap.get(actorId) ?? `유저-${actorId.replace('anon-', '').slice(-4)}`;
  return actorId === selfActorId ? `${alias} (나)` : alias;
};
