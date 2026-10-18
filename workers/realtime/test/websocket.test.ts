import { SELF, env, runInDurableObject, evictDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

async function create(maxCapacity = 10) {
  const response = await SELF.fetch('https://worker.test/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': crypto.randomUUID() },
    body: JSON.stringify({
      gameType: 'roulette',
      maxCapacity,
      actorId: 'anon-host1234',
      state: {
        revision: 0,
        lastActor: 'anon-host1234',
        step: 0,
        orderState: { angle: 0, total: [] },
        resultIndex: null,
      },
    }),
  });
  return response.json() as Promise<any>;
}
async function connect(id: string, token: string) {
  const response = await SELF.fetch(`https://worker.test/rooms/${id}/connect`, { headers: { Upgrade: 'websocket' } });
  const ws = response.webSocket!;
  ws.accept();
  const events: any[] = [];
  ws.addEventListener('message', e => {
    events.push(JSON.parse(String(e.data)));
  });
  ws.send(JSON.stringify({ v: 1, type: 'authenticate', token }));
  await until(() => events.some(e => e.type === 'snapshot'));
  return { ws, events };
}
async function until(check: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('message timeout');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
describe('authenticated durable sockets', () => {
  it('enforces capacity at authentication even when sessions were issued before anyone connected', async () => {
    const { room, token } = await create(2);
    const join = async () =>
      (
        (await (
          await SELF.fetch(`https://worker.test/rooms/${room.id}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          })
        ).json()) as any
      ).token;
    const firstToken = await join();
    const excessToken = await join();
    const host = await connect(room.id, token);
    const first = await connect(room.id, firstToken);
    const response = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
      headers: { Upgrade: 'websocket' },
    });
    const excess = response.webSocket!;
    excess.accept();
    const events: any[] = [];
    excess.addEventListener('message', event => {
      events.push(JSON.parse(String(event.data)));
    });
    excess.send(JSON.stringify({ v: 1, type: 'authenticate', token: excessToken }));
    await until(() => events.some(event => event.code === 'ROOM_FULL'));
    expect(events.some(event => event.type === 'snapshot')).toBe(false);
    host.ws.close();
    first.ws.close();
    excess.close();
  });
  it('releases unauthenticated sockets after the authentication deadline without expiring the room', async () => {
    const { room } = await create();
    const response = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
      headers: { Upgrade: 'websocket' },
    });
    const ws = response.webSocket!;
    ws.accept();
    let closed = false;
    ws.addEventListener('close', () => {
      closed = true;
    });
    const stub = (env as any).ROOMS.get((env as any).ROOMS.idFromName(room.id));
    await runInDurableObject(stub, async (_instance, state) => {
      for (const socket of state.getWebSockets()) {
        const attachment = socket.deserializeAttachment() as any;
        socket.serializeAttachment({ ...attachment, connectedAt: Date.now() - 11000 });
      }
      await state.storage.setAlarm(Date.now());
    });
    await runDurableObjectAlarm(stub);
    await until(() => closed);
    expect((await SELF.fetch(`https://worker.test/rooms/${room.id}`)).status).toBe(200);
  });
  it('broadcasts only committed state, rejects member writes and stale revisions', async () => {
    const { room, token } = await create();
    const join = await SELF.fetch(`https://worker.test/rooms/${room.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const memberToken = ((await join.json()) as any).token;
    const host = await connect(room.id, token);
    const member = await connect(room.id, memberToken);
    host.ws.send(
      JSON.stringify({
        v: 1,
        type: 'state_update',
        requestId: 'change',
        expectedRevision: 0,
        state: { ...room.state, step: 1 },
      })
    );
    await until(() => member.events.some(e => e.type === 'state_updated'));
    expect(member.events.find(e => e.type === 'state_updated').room.state.revision).toBe(1);
    member.ws.send(
      JSON.stringify({ v: 1, type: 'state_update', requestId: 'forged', expectedRevision: 1, state: room.state })
    );
    await until(() => member.events.some(e => e.code === 'HOST_PERMISSION_REQUIRED'));
    host.ws.send(
      JSON.stringify({ v: 1, type: 'state_update', requestId: 'stale', expectedRevision: 0, state: room.state })
    );
    await until(() => host.events.some(e => e.code === 'STALE_REVISION'));
    expect(host.events.find(e => e.code === 'STALE_REVISION').room.state.revision).toBe(1);
    host.ws.close();
    member.ws.close();
  });
  it('does not grant a new session the creator identity or host role', async () => {
    const { room } = await create();
    const response = await SELF.fetch(`https://worker.test/rooms/${room.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: 'anon-host1234' }),
    });
    const joined = (await response.json()) as any;
    expect(joined.actorId).not.toBe('anon-host1234');
    const member = await connect(room.id, joined.token);
    expect(member.events.find(e => e.type === 'snapshot').role).toBe('member');
    member.ws.close();
  });
  it('restores persisted snapshots and authenticated attachments after hibernation', async () => {
    const { room, token } = await create();
    const host = await connect(room.id, token);
    const stub = (env as any).ROOMS.get((env as any).ROOMS.idFromName(room.id));
    await evictDurableObject(stub);
    host.ws.send(JSON.stringify({ v: 1, type: 'presence_update', requestId: 'presence', presence: { cardIndex: 1 } }));
    await until(() => host.events.some(e => e.type === 'ack' && e.requestId === 'presence'));
    const persisted = await runInDurableObject(stub, async (_instance, state) => state.storage.get('room'));
    expect((persisted as any).id).toBe(room.id);
    host.ws.close();
  });
});
