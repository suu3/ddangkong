import { afterEach, expect, it, vi } from 'vitest';
import { getRoomStore } from './store';

class Socket {
  static instances: Socket[] = [];
  readyState = 1;
  onopen: any;
  onclose: any;
  onmessage: any;
  onerror: any;
  constructor() {
    Socket.instances.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  Socket.instances = [];
});
it('recognizes an expired room even when this browser has a saved room session', async () => {
  vi.stubGlobal('WebSocket', Socket);
  vi.stubEnv('NEXT_PUBLIC_REALTIME_API_URL', 'https://worker.test');
  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => JSON.stringify({ token: 'secret', actorId: 'anon-member123', role: 'member' }),
      setItem() {},
    },
  });
  vi.stubGlobal('fetch', async () => Response.json({ error: { code: 'ROOM_NOT_FOUND_OR_EXPIRED' } }, { status: 404 }));
  const store = getRoomStore('expired-test');
  const release = store.acquire();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(store.getSnapshot().status).toBe('expired');
  expect(Socket.instances).toHaveLength(0);
  release();
});
it('shares one socket between consumers, ignores old revisions and releases it after the last consumer', async () => {
  vi.stubGlobal('WebSocket', Socket);
  vi.stubEnv('NEXT_PUBLIC_REALTIME_API_URL', 'https://worker.test');
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem() {} } });
  const room = {
    id: 'shared-test',
    gameType: 'roulette',
    name: '방',
    maxCapacity: 10,
    createdAt: '2026-10-19T00:00:00Z',
    expiresAt: '2026-10-20T00:00:00Z',
    state: { revision: 2, lastActor: null },
  };
  vi.stubGlobal('fetch', async () =>
    Response.json({ token: 'secret', actorId: 'anon-member123', role: 'member', room })
  );
  const store = getRoomStore('shared-test');
  const first = store.acquire();
  const second = getRoomStore('shared-test').acquire();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(Socket.instances).toHaveLength(1);
  Socket.instances[0].receive({ v: 1, type: 'snapshot', room, actorId: 'anon-member123', role: 'member' });
  Socket.instances[0].receive({
    v: 1,
    type: 'state_updated',
    room: { ...room, state: { revision: 1, lastActor: null } },
    requestId: 'old',
  });
  expect(store.getSnapshot().room?.state.revision).toBe(2);
  first();
  expect(Socket.instances[0].readyState).toBe(1);
  second();
  expect(Socket.instances[0].readyState).toBe(3);
});
