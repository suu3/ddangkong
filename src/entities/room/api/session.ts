export interface RoomSession {
  token: string;
  actorId: string;
  role: 'host' | 'member';
}
const memorySessions = new Map<string, RoomSession>();
const key = (roomId: string) => `realtime:session:${roomId}`;
export function readSession(roomId: string): RoomSession | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(key(roomId)) ?? 'null');
    if (value && typeof value.token === 'string' && typeof value.actorId === 'string' && ['host', 'member'].includes(value.role))
      return value;
  } catch { /* Private browsing can deny persistent storage. */ }
  return memorySessions.get(roomId) ?? null;
}
export function saveSession(roomId: string, value: RoomSession) {
  memorySessions.set(roomId, { ...value });
  try { window.localStorage.setItem(key(roomId), JSON.stringify(value)); }
  catch { /* Keep this tab connected; reload recovery requires persistent storage. */ }
}
