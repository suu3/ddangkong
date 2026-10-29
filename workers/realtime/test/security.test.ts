import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';

async function create() {
  const response = await SELF.fetch('https://worker.test/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': crypto.randomUUID() },
    body: JSON.stringify({
      gameType: 'roulette',
      actorId: 'anon-host1234',
      state: {
        revision: 0,
        lastActor: null,
        step: 0,
        orderState: { angle: 0, total: [] },
        resultIndex: null,
      },
    }),
  });
  return response.json() as Promise<any>;
}
const join = (id: string, ip: string) =>
  SELF.fetch(`https://worker.test/rooms/${id}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: '{}',
  });
it('limits repeated joins per IP without blocking a different participant', async () => {
  const { room } = await create();
  const ip = crypto.randomUUID();
  for (let i = 0; i < 30; i++) expect((await join(room.id, ip)).status).toBe(200);
  expect((await join(room.id, ip)).status).toBe(429);
  expect((await join(room.id, crypto.randomUUID())).status).toBe(200);
});
it('reclaims expired unused sessions without revoking the host', async () => {
  const { room, token } = await create();
  const stub = (env as any).ROOMS.get((env as any).ROOMS.idFromName(room.id));
  await runInDurableObject(stub, async (_instance, state) => {
    for (let i = 0; i < 199; i++)
      await state.storage.put(`session:unused-${i}`, {
        actorId: `anon-unused${i.toString().padStart(8, '0')}`,
        role: 'member',
        expiresAt: Date.now() - 1,
      });
  });
  expect((await join(room.id, crypto.randomUUID())).status).toBe(200);
  const response = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
    headers: { Upgrade: 'websocket' },
  });
  const ws = response.webSocket!;
  ws.accept();
  const snapshot = new Promise<any>(resolve =>
    ws.addEventListener('message', e => resolve(JSON.parse(String(e.data))), { once: true })
  );
  ws.send(JSON.stringify({ v: 1, type: 'authenticate', token }));
  expect((await snapshot).role).toBe('host');
  ws.close();
});
it('limits connection attempts per IP even when sockets are closed', async () => {
  const { room } = await create();
  const ip = crypto.randomUUID();
  for (let i = 0; i < 60; i++) {
    const response = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
      headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ip },
    });
    if (response.webSocket) {
      response.webSocket.accept();
      response.webSocket.close();
    }
  }
  expect(
    (
      await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
        headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ip },
      })
    ).status
  ).toBe(429);
});
it('reserves room connections by limiting unauthenticated sockets from one IP', async () => {
  const { room } = await create();
  const sockets: WebSocket[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const response = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
        headers: { Upgrade: 'websocket', 'CF-Connecting-IP': 'pending-attacker' },
      });
      response.webSocket!.accept();
      sockets.push(response.webSocket!);
    }
    const denied = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
      headers: { Upgrade: 'websocket', 'CF-Connecting-IP': 'pending-attacker' },
    });
    if (denied.webSocket) {
      denied.webSocket.accept();
      sockets.push(denied.webSocket);
    }
    expect(denied.status).toBe(429);
    const allowed = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
      headers: { Upgrade: 'websocket', 'CF-Connecting-IP': 'legitimate-participant' },
    });
    expect(allowed.status).toBe(101);
    allowed.webSocket!.accept();
    sockets.push(allowed.webSocket!);
  } finally {
    sockets.forEach(ws => ws.close());
  }
});
it('does not permanently fill session storage with unexpired abandoned credentials', async () => {
  const { room } = await create();
  const stub = (env as any).ROOMS.get((env as any).ROOMS.idFromName(room.id));
  await runInDurableObject(stub, async (_instance, state) => {
    for (let i = 0; i < 199; i++)
      await state.storage.put(`session:unused-${i}`, {
        actorId: `anon-unused${i.toString().padStart(8, '0')}`,
        role: 'member',
        expiresAt: Date.now() + 60000,
      });
  });
  expect((await join(room.id, crypto.randomUUID())).status).toBe(200);
  const size = await runInDurableObject(
    stub,
    async (_instance, state) => (await state.storage.list({ prefix: 'session:' })).size
  );
  expect(size).toBe(200);
});
it('rejects expired credentials when authenticating', async () => {
  const { room } = await create();
  const joined = (await (await join(room.id, crypto.randomUUID())).json()) as any;
  const stub = (env as any).ROOMS.get((env as any).ROOMS.idFromName(room.id));
  await runInDurableObject(stub, async (_instance, state) => {
    const sessions = await state.storage.list<any>({ prefix: 'session:' });
    for (const [key, value] of sessions)
      if (value.role === 'member') await state.storage.put(key, { ...value, expiresAt: Date.now() - 1 });
  });
  const response = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
    headers: { Upgrade: 'websocket' },
  });
  const ws = response.webSocket!;
  ws.accept();
  const event = new Promise<any>(resolve =>
    ws.addEventListener('message', e => resolve(JSON.parse(String(e.data))), { once: true })
  );
  ws.send(JSON.stringify({ v: 1, type: 'authenticate', token: joined.token }));
  expect((await event).code).toBe('ROOM_SESSION_REQUIRED');
  ws.close();
});
it('prevents one authenticated session from taking every room connection', async () => {
  const { room, token } = await create();
  const sockets: WebSocket[] = [];
  try {
    for (let i = 0; i < 4; i++) {
      const response = await SELF.fetch(`https://worker.test/rooms/${room.id}/connect`, {
        headers: { Upgrade: 'websocket', 'CF-Connecting-IP': crypto.randomUUID() },
      });
      const ws = response.webSocket!;
      ws.accept();
      sockets.push(ws);
      const event = new Promise<any>(resolve =>
        ws.addEventListener('message', e => resolve(JSON.parse(String(e.data))), { once: true })
      );
      ws.send(JSON.stringify({ v: 1, type: 'authenticate', token }));
      const result = await event;
      if (i < 3) expect(result.type).toBe('snapshot');
      else expect(result.code).toBe('TOO_MANY_CONNECTIONS');
    }
  } finally {
    sockets.forEach(ws => ws.close());
  }
});
