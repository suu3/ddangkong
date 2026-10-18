export interface RoomSession {
  token: string;
  actorId: string;
  role: 'host' | 'member';
}
const key = (roomId: string) => `realtime:session:${roomId}`;
export function readSession(roomId: string): RoomSession | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(key(roomId)) ?? 'null');
    return value &&
      typeof value.token === 'string' &&
      typeof value.actorId === 'string' &&
      ['host', 'member'].includes(value.role)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveSession(roomId: string, value: RoomSession) {
  try {
    window.localStorage.setItem(key(roomId), JSON.stringify(value));
  } catch {
    throw new Error('브라우저 저장 공간을 사용할 수 없어 방 접속 정보를 보관할 수 없어요.');
  }
}
