import { env, SELF, runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

export const rouletteState = {
  step: 0,
  orderState: { angle: 0, total: [] },
  resultIndex: null,
  revision: 0,
  lastActor: 'anon-host1234',
};
export async function createTestRoom(ip = crypto.randomUUID()) {
  return SELF.fetch('https://worker.test/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ gameType: 'roulette', actorId: 'anon-host1234', state: rouletteState }),
  });
}
describe('room routes', () => {
  it('persists a room, hashes host credentials and fixes expiry to creation + 24h', async () => {
    const response = await createTestRoom();
    expect(response.status).toBe(201);
    const { room, token } = (await response.json()) as any;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(Date.parse(room.expiresAt) - Date.parse(room.createdAt)).toBe(86400000);
    const restored = await SELF.fetch(`https://worker.test/rooms/${room.id}`);
    const body = await restored.text();
    expect(JSON.parse(body).state).toEqual(rouletteState);
    expect(body.includes(token)).toBe(false);
  });
  it('rejects the sixth concurrent room creation from the same IP', async () => {
    const ip = crypto.randomUUID();
    const responses = await Promise.all(Array.from({ length: 6 }, () => createTestRoom(ip)));
    expect(responses.filter(r => r.status === 201)).toHaveLength(5);
    expect(responses.filter(r => r.status === 429)).toHaveLength(1);
  });
  it('rejects unapproved origins and invalid initial state', async () => {
    const rejected = await SELF.fetch('https://worker.test/rooms', {
      method: 'POST',
      headers: { Origin: 'https://attacker.test' },
    });
    expect(rejected.status).toBe(403);
    const invalid = await SELF.fetch('https://worker.test/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType: 'roulette', actorId: 'anon-host1234', state: { revision: 0 } }),
    });
    expect(invalid.status).toBe(400);
  });
  it('cleans up expired room storage and returns the combined missing/expired response', async () => {
    const { room } = (await (await createTestRoom()).json()) as any;
    const stub = (env as any).ROOMS.get((env as any).ROOMS.idFromName(room.id));
    await runInDurableObject(stub, async (_instance, state) => {
      const data = await state.storage.get<any>('room');
      await state.storage.put('room', { ...data, expiresAt: new Date(Date.now() - 1).toISOString() });
      await state.storage.setAlarm(Date.now());
    });
    await runDurableObjectAlarm(stub);
    expect((await SELF.fetch(`https://worker.test/rooms/${room.id}`)).status).toBe(404);
  });
  it('expires a running bomb on the server while retaining the room and its fixed lifetime', async () => {
    const { room } = (await (await createTestRoom()).json()) as any;
    const stub = (env as any).ROOMS.get((env as any).ROOMS.idFromName(room.id));
    await runInDurableObject(stub, async (_instance, storage) => {
      const current = await storage.storage.get<any>('room');
      await storage.storage.put('room', {
        ...current,
        gameType: 'hot_potato',
        state: {
          revision: 0,
          lastActor: null,
          game: { status: 'running', roundId: 1, holderUserId: 'anon-host1234', endsAtMs: Date.now() - 1, history: [] },
        },
      });
      await storage.storage.setAlarm(Date.now());
    });
    await runDurableObjectAlarm(stub);
    const response = await SELF.fetch(`https://worker.test/rooms/${room.id}`);
    expect(response.status).toBe(200);
    const ended = (await response.json()) as any;
    expect(ended.state.game.status).toBe('ended');
    expect(ended.state.game.winnerUserId).toBe('anon-host1234');
    expect(ended.expiresAt).toBe(room.expiresAt);
  });
});
