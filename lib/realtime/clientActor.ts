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
      return 'guest';
    }

    const data = (await response.json()) as { actorId?: string };
    return data.actorId ?? 'guest';
  } catch {
    return 'guest';
  }
};
