import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealtimeSocket } from './realtime-client';

class Socket {
  static instances: Socket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: null | (() => void) = null;
  onclose: null | (() => void) = null;
  onerror: null | (() => void) = null;
  onmessage: null | ((e: { data: string }) => void) = null;
  constructor(public url: string) {
    Socket.instances.push(this);
  }
  send(message: string) {
    this.sent.push(message);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Socket.instances = [];
});
describe('room socket lifecycle', () => {
  it('checks for room expiry before reopening a disconnected socket', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', Socket);
    const client = new RealtimeSocket(
      'https://worker.test',
      'room-id',
      'token',
      () => {},
      () => {},
      async () => false
    );
    client.connect();
    Socket.instances[0].close();
    await vi.advanceTimersByTimeAsync(250);
    expect(Socket.instances).toHaveLength(1);
    client.close();
  });
  it('keeps a single connecting socket and ignores close events from replaced sockets', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', Socket);
    const client = new RealtimeSocket(
      'https://worker.test',
      'room-id',
      'token',
      () => {},
      () => {}
    );
    client.connect();
    client.connect();
    expect(Socket.instances).toHaveLength(1);
    const first = Socket.instances[0];
    first.close();
    await vi.advanceTimersByTimeAsync(250);
    const current = Socket.instances[1];
    current.open();
    const room = {
      id: 'room-id',
      gameType: 'roulette',
      name: '방',
      maxCapacity: 10,
      createdAt: '2026-10-19T00:00:00Z',
      expiresAt: '2026-10-20T00:00:00Z',
      state: { revision: 1, lastActor: null },
    };
    current.receive({ v: 1, type: 'snapshot', room, actorId: 'anon-host1234', role: 'host' });
    first.onclose?.();
    const request = client.request({ type: 'presence_update', presence: { cardIndex: null } });
    const id = JSON.parse(current.sent.at(-1)!).requestId;
    current.receive({ v: 1, type: 'ack', requestId: id });
    await expect(request).resolves.toBeUndefined();
    client.close();
  });
  it('authenticates in the first frame, resolves canonical acknowledgements, rejects disconnected requests', async () => {
    vi.stubGlobal('WebSocket', Socket);
    const events: unknown[] = [];
    const client = new RealtimeSocket(
      'https://worker.test',
      'room-id',
      'secret-token',
      e => events.push(e),
      () => {}
    );
    client.connect();
    const socket = Socket.instances[0];
    socket.open();
    expect(socket.url).toBe('wss://worker.test/rooms/room-id/connect');
    expect(socket.url).not.toContain('secret-token');
    expect(JSON.parse(socket.sent[0])).toEqual({ v: 1, type: 'authenticate', token: 'secret-token' });
    const room = {
      id: 'room-id',
      gameType: 'roulette',
      name: '방',
      maxCapacity: 10,
      createdAt: '2026-10-19T00:00:00Z',
      expiresAt: '2026-10-20T00:00:00Z',
      state: { revision: 1, lastActor: null },
    };
    socket.receive({ v: 1, type: 'snapshot', room, actorId: 'anon-host1234', role: 'host' });
    const pending = client.request({
      type: 'state_update',
      state: { revision: 1, lastActor: null },
      expectedRevision: 1,
    });
    const requestId = JSON.parse(socket.sent[1]).requestId;
    socket.receive({ v: 1, type: 'state_updated', room, requestId });
    await expect(pending).resolves.toEqual(room);
    const disconnected = client.request({ type: 'presence_update', presence: { cardIndex: null } });
    const assertion = expect(disconnected).rejects.toThrow('CONNECTION_LOST');
    client.close();
    await assertion;
  });
  it('reconnects with backoff, ignores malformed server frames and never reconnects after disposal', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', Socket);
    const onEvent = vi.fn();
    const client = new RealtimeSocket('http://localhost:8787', 'r', 't', onEvent, () => {});
    client.connect();
    Socket.instances[0].close();
    await vi.advanceTimersByTimeAsync(249);
    expect(Socket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(Socket.instances).toHaveLength(2);
    Socket.instances[1].onmessage?.({ data: '{bad' });
    Socket.instances[1].receive({ v: 2, type: 'state_updated', room: {} });
    expect(onEvent).not.toHaveBeenCalled();
    Socket.instances[1].close();
    await vi.advanceTimersByTimeAsync(499);
    expect(Socket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(Socket.instances).toHaveLength(3);
    client.close();
    await vi.advanceTimersByTimeAsync(20000);
    expect(Socket.instances).toHaveLength(3);
  });
});
