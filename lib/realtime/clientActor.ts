const ACTOR_STORAGE_KEY = 'realtime:actor-id';

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

export const getServerActor = async () => {
  if (typeof window === 'undefined') {
    return 'guest';
  }

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
      window.localStorage.setItem(ACTOR_STORAGE_KEY, actorId);
      return actorId;
    }

    return getOrCreateLocalActor();
  } catch {
    return getOrCreateLocalActor();
  }
};
