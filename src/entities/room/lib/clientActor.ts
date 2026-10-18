const ACTOR_STORAGE_KEY = 'realtime:actor-id';
const ACTOR_ROTATED_KEY = 'realtime:actor-rotated';

const getOrCreateLocalActor = () => {
  if (typeof window === 'undefined') {
    return 'guest';
  }

  const existing = window.localStorage.getItem(ACTOR_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = `anon-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  window.localStorage.setItem(ACTOR_STORAGE_KEY, created);
  return created;
};

/**
 * 서버 쿠키(`dd_actor`)가 만료/삭제되어 새 actorId가 발급되면 기록해 둡니다.
 * 사용자에게 "이전 기록과 연결되지 않는다"는 점을 한 번 안내하기 위한 플래그입니다.
 */
const markActorRotated = (previousActor: string, nextActor: string) => {
  if (previousActor === nextActor) return;
  window.localStorage.setItem(ACTOR_ROTATED_KEY, JSON.stringify({ previousActor, rotatedAt: Date.now() }));
};

/** 재발급 안내를 한 번만 노출하고 플래그를 지웁니다. */
export const consumeActorRotationNotice = () => {
  if (typeof window === 'undefined') return false;

  const raw = window.localStorage.getItem(ACTOR_ROTATED_KEY);
  if (!raw) return false;

  window.localStorage.removeItem(ACTOR_ROTATED_KEY);
  return true;
};

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

export const getServerActor = async () => {
  if (typeof window === 'undefined') {
    return 'guest';
  }

  const previousActor = window.localStorage.getItem(ACTOR_STORAGE_KEY);

  try {
    const response = await fetch('/api/realtime/actor', {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return getOrCreateLocalActor();
    }

    const data = (await response.json()) as { actorId?: string };
    const actorId = data.actorId;
    if (actorId && actorId !== 'guest') {
      if (previousActor) {
        markActorRotated(previousActor, actorId);
      }

      window.localStorage.setItem(ACTOR_STORAGE_KEY, actorId);
      return actorId;
    }

    return getOrCreateLocalActor();
  } catch {
    return getOrCreateLocalActor();
  }
};
