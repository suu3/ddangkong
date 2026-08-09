# Cloudflare Realtime Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase database, Broadcast, and Presence with a Cloudflare Worker and SQLite-backed Durable Objects while preserving all four shared games, adding room chat, and keeping results available for 24 hours.

**Architecture:** A stateless Worker validates public HTTP requests and routes each `roomId` to one `RoomDurableObject`; a second `CreationLimiter` object enforces room creation limits. The room object owns its SQLite snapshot, participant sessions, chat, hibernatable WebSockets, Presence, authorization, revision ordering, and fixed expiration alarm. The Next.js app talks only to a typed HTTP/WebSocket client and stores room-scoped tokens locally.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript 5.9, Cloudflare Workers/Wrangler 4.120, SQLite-backed Durable Objects, Vitest 4.1 with `@cloudflare/vitest-pool-workers`, Playwright

## Global Constraints

- Use Durable Object SQLite storage only; do not add Supabase, Neon, D1, KV, or R2.
- Set every room's immutable `expiresAt` to `createdAt + 24 hours`; activity must not extend it.
- Keep at most 200 chat messages per room, at most 500 characters per message, and at most 5 messages per actor per rolling 10 seconds.
- Limit room creation to 5 rooms per IP hash per rolling 10 minutes.
- Never put host or participant tokens in a URL; send them only in HTTP bodies or the first TLS-protected WebSocket authentication event.
- Use WebSocket Hibernation APIs (`ctx.acceptWebSocket`, attachments, `ctx.getWebSockets`) and do not use server-side `setInterval`.
- Preserve local/offline game behavior when realtime configuration is absent or Cloudflare is unavailable.
- Keep current room links in the form `?roomId=<uuid>` and show one combined message for missing or fully expired rooms.
- Final production code must contain no Supabase SDK import, environment variable, channel, or table dependency.
- Use `pnpm@9.15.9` and Node.js 20.9 or newer.

---

## Planned File Structure

### Cloudflare backend

- `workers/realtime/wrangler.jsonc`: Worker entry point, CORS variables, and both SQLite Durable Object bindings.
- `workers/realtime/tsconfig.json`: Worker-only TypeScript environment.
- `workers/realtime/vitest.config.ts`: Cloudflare runtime test configuration.
- `workers/realtime/test/tsconfig.json`: `cloudflare:test` type declarations.
- `workers/realtime/worker-configuration.d.ts`: generated Worker binding types.
- `workers/realtime/src/index.ts`: CORS, routing, room creation, join, snapshot, and WebSocket upgrade endpoints.
- `workers/realtime/src/room.ts`: room SQLite schema, alarm, sessions, state, chat, Presence, and WebSocket handlers.
- `workers/realtime/src/creationLimiter.ts`: IP-hash rolling room creation limit.
- `workers/realtime/src/authorization.ts`: game-specific host and participant command validation.
- `workers/realtime/src/storage.ts`: SQL row serialization and transaction helpers.
- `workers/realtime/test/routes.test.ts`: public HTTP contract tests.
- `workers/realtime/test/room.test.ts`: persistence, revision, authorization, chat, WebSocket, hibernation, and alarm tests.

### Shared and browser code

- `lib/realtime/protocol.ts`: dependency-free room, command, client event, server event, and error types shared by Worker and browser.
- `lib/realtime/env.ts`: `NEXT_PUBLIC_REALTIME_API_URL` parsing.
- `lib/realtime/session.ts`: host and participant token storage scoped by room.
- `lib/realtime/client.ts`: typed HTTP and reconnecting WebSocket client.
- `lib/realtime/useRealtimeRoom.ts`: React lifecycle adapter for snapshot, Presence, chat, and state updates.
- `lib/realtime/rooms.ts`: room ID/name/capacity helpers and compatibility exports without Supabase.
- `lib/realtime/channel.ts`: removed after all callers use `useRealtimeRoom`.
- `components/realtime/RoomSharePanel.tsx`: configuration copy, Presence props, connection state, expiry copy, and chat UI integration.
- `components/realtime/RoomChat.tsx`: bounded room chat list and send form.
- `app/roulette/page.tsx`: first Cloudflare migration and host-only state updates.
- `app/coffee/page.tsx`: shared state plus participant card-selection commands.
- `app/team-split/page.tsx`: host-only team state updates.
- `app/hot-potato/page.tsx`: participant join/ready/rename/pass commands plus host state updates.
- `e2e/realtime-roulette.spec.ts`: two-browser result, reconnect, and permission test.
- `e2e/realtime-chat.spec.ts`: chat sharing and refresh test.
- `playwright.config.ts`: starts Next.js and local Wrangler for browser tests.
- `vitest.config.ts`: browser-client unit test configuration that excludes Worker and E2E suites.

---

### Task 1: Worker Test Harness and Shared Protocol

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `workers/realtime/wrangler.jsonc`
- Create: `workers/realtime/tsconfig.json`
- Create: `workers/realtime/vitest.config.ts`
- Create: `workers/realtime/test/tsconfig.json`
- Create: `workers/realtime/test/protocol.test.ts`
- Create: `lib/realtime/protocol.ts`

**Interfaces:**
- Produces: `RoomSnapshot<TState>`, `RoomSession`, `ParticipantCommand`, `ClientEvent<TState>`, `ServerEvent<TState>`, `RealtimeErrorCode`, `parseClientEvent(value)`.
- Consumes: no application modules; `protocol.ts` must remain safe in browser and Workers runtimes.

- [ ] **Step 1: Install pinned Worker test dependencies and add scripts**

Run:

```powershell
pnpm.cmd add -D wrangler@4.120.0 vitest@4.1.10 @cloudflare/vitest-pool-workers@0.20.3 @cloudflare/workers-types@5.20260809.1 @playwright/test@1.62.1
```

Add scripts:

```json
{
  "test": "vitest run",
  "test:worker": "vitest run --config workers/realtime/vitest.config.ts",
  "realtime:dev": "wrangler dev --config workers/realtime/wrangler.jsonc",
  "realtime:deploy": "wrangler deploy --config workers/realtime/wrangler.jsonc",
  "test:e2e": "playwright test"
}
```

Exclude `workers/realtime` from the root Next.js `tsconfig.json`; the Worker has its own TypeScript project. Configure root `vitest.config.ts` to include `lib/**/*.test.ts` and exclude `workers/realtime/test/**` and `e2e/**`.

- [ ] **Step 2: Configure the SQLite Durable Objects and test runtime**

Use compatibility date `2026-08-09`, binding names `ROOMS` and `CREATION_LIMITERS`, and migrations with `new_sqlite_classes` for `RoomDurableObject` and `CreationLimiter`. Set local `ALLOWED_ORIGINS` to `http://localhost:3000`.

- [ ] **Step 3: Write the failing protocol parser test**

```ts
import { describe, expect, it } from 'vitest';
import { parseClientEvent } from '../../../lib/realtime/protocol';

describe('parseClientEvent', () => {
  it('accepts a versioned authentication event and rejects unknown versions', () => {
    expect(parseClientEvent({ v: 1, type: 'authenticate', actorId: 'anon-a', token: 'secret' })).toEqual({
      v: 1,
      type: 'authenticate',
      actorId: 'anon-a',
      token: 'secret',
    });
    expect(() => parseClientEvent({ v: 2, type: 'authenticate' })).toThrow('UNSUPPORTED_PROTOCOL');
  });
});
```

- [ ] **Step 4: Run the test and confirm it fails because the protocol module is absent**

Run: `pnpm.cmd test:worker -- workers/realtime/test/protocol.test.ts`

Expected: FAIL resolving `lib/realtime/protocol.ts` or `parseClientEvent`.

- [ ] **Step 5: Implement the exact v1 event union and runtime parser**

The union must include `authenticate`, `state_update`, `participant_command`, `presence_update`, and `chat_send` client events plus `snapshot`, `authenticated`, `state_updated`, `presence_updated`, `chat_added`, `room_expired`, `ack`, and `error` server events. Every mutating event carries a `requestId`; every state mutation carries `expectedRevision`.

```ts
export type ParticipantCommand =
  | { kind: 'coffee.select'; cardIndex: number | null }
  | { kind: 'hot_potato.join'; nickname: string; isReady: boolean }
  | { kind: 'hot_potato.rename'; nickname: string }
  | { kind: 'hot_potato.ready'; isReady: boolean }
  | { kind: 'hot_potato.pass'; toActorId: string; atMs: number };

export interface RoomSnapshot<TState> {
  id: string;
  gameType: 'coffee' | 'roulette' | 'hot_potato' | 'team_split';
  name: string;
  maxCapacity: number;
  state: TState;
  revision: number;
  createdAt: string;
  expiresAt: string;
}
```

- [ ] **Step 6: Run the protocol test and typecheck**

Run: `pnpm.cmd test:worker -- workers/realtime/test/protocol.test.ts`

Expected: PASS.

Run: `pnpm.cmd exec tsc --noEmit`

Expected: exit 0.

Run: `pnpm.cmd exec tsc -p workers/realtime/tsconfig.json --noEmit`

Expected: exit 0.

- [ ] **Step 7: Commit the protocol foundation**

```powershell
git add package.json pnpm-lock.yaml workers/realtime lib/realtime/protocol.ts
git commit -m "feat: scaffold Cloudflare realtime worker"
```

---

### Task 2: Room Creation, SQLite Snapshot, Expiry, and Rate Limiting

**Files:**
- Create: `workers/realtime/src/storage.ts`
- Create: `workers/realtime/src/creationLimiter.ts`
- Create: `workers/realtime/src/room.ts`
- Create: `workers/realtime/src/index.ts`
- Create: `workers/realtime/test/routes.test.ts`
- Modify: `workers/realtime/wrangler.jsonc`

**Interfaces:**
- Consumes: `RoomSnapshot<TState>` and `RealtimeErrorCode` from `lib/realtime/protocol.ts`.
- Produces: `POST /rooms`, `POST /rooms/:roomId/join`, `GET /rooms/:roomId`, `GET /rooms/:roomId/connect`, `RoomDurableObject`, and `CreationLimiter`.

- [ ] **Step 1: Write failing route tests for creation, lookup, fixed expiry, and the sixth request**

```ts
it('creates a room with a fixed 24 hour expiry and returns it', async () => {
  const created = await createTestRoom({ gameType: 'roulette', actorId: 'anon-host', state: { revision: 0 } });
  expect(Date.parse(created.room.expiresAt) - Date.parse(created.room.createdAt)).toBe(86_400_000);
  expect(created.hostToken.length).toBeGreaterThanOrEqual(32);
  const response = await SELF.fetch(`https://worker.test/rooms/${created.room.id}`);
  expect(response.status).toBe(200);
});

it('rejects the sixth room from one IP inside ten minutes', async () => {
  const responses = await Promise.all(
    Array.from({ length: 6 }, () => createRoomRequest({ 'CF-Connecting-IP': '203.0.113.8' }))
  );
  expect(responses.filter(response => response.status === 201)).toHaveLength(5);
  expect(responses.filter(response => response.status === 429)).toHaveLength(1);
});
```

- [ ] **Step 2: Run the route tests and verify endpoint failures**

Run: `pnpm.cmd test:worker -- workers/realtime/test/routes.test.ts`

Expected: FAIL because `src/index.ts`, SQL tables, and bindings are not implemented.

- [ ] **Step 3: Implement strict request validation and CORS**

Allow only configured origins, `Content-Type: application/json`, UUID room IDs, known game types, names up to 30 characters, capacities from 2 through 20, and serialized initial state up to 64 KiB. Return JSON errors in the form:

```ts
interface ErrorResponse {
  error: { code: RealtimeErrorCode; message: string; requestId: string };
}
```

- [ ] **Step 4: Implement SQLite initialization and room creation**

Create singleton `room` and bounded `messages` and `sessions` tables in `blockConcurrencyWhile`. Store ISO timestamps and serialized state. Hash all tokens with SHA-256 before insertion and return the original token only once.

```sql
CREATE TABLE IF NOT EXISTS room (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  name TEXT NOT NULL,
  max_capacity INTEGER NOT NULL,
  host_actor_id TEXT NOT NULL,
  host_token_hash TEXT NOT NULL,
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

- [ ] **Step 5: Implement `CreationLimiter` with a rolling timestamp list and alarm cleanup**

Name limiter objects by a SHA-256 hash of `CF-Connecting-IP`; never store the raw address. Serialize each request through the object, retain only timestamps newer than 10 minutes, allow five, and return 429 on the sixth.

- [ ] **Step 6: Implement the room alarm and missing/expired responses**

At alarm time, broadcast `room_expired`, close attached sockets with code 4001, call `deleteAll()`, and make later lookup return `404 ROOM_NOT_FOUND_OR_EXPIRED`. If a request observes an elapsed `expiresAt` before alarm deletion, return `410 ROOM_EXPIRED` and trigger cleanup.

- [ ] **Step 7: Run focused and full Worker tests**

Run: `pnpm.cmd test:worker -- workers/realtime/test/routes.test.ts`

Expected: PASS.

Run: `pnpm.cmd test:worker`

Expected: all Worker tests pass.

- [ ] **Step 8: Commit room persistence and routing**

```powershell
git add workers/realtime
git commit -m "feat: add durable realtime rooms"
```

---

### Task 3: Room Sessions and Game-Specific Authorization

**Files:**
- Create: `workers/realtime/src/authorization.ts`
- Create: `workers/realtime/test/authorization.test.ts`
- Modify: `workers/realtime/src/room.ts`
- Modify: `workers/realtime/test/routes.test.ts`

**Interfaces:**
- Consumes: `ParticipantCommand`, room `gameType`, previous state, actor ID, and session role.
- Produces: `authorizeHostStateUpdate(role)`, `applyParticipantCommand(gameType, state, actorId, command, now)` and participant tokens from `POST /rooms/:roomId/join`.

- [ ] **Step 1: Write failing authorization matrix tests**

```ts
it.each(['roulette', 'team_split'] as const)('blocks member state replacement for %s', gameType => {
  expect(() => authorizeHostStateUpdate({ gameType, role: 'member' })).toThrow('HOST_PERMISSION_REQUIRED');
});

it('changes only the coffee actor selection', () => {
  const next = applyParticipantCommand('coffee', coffeeState, 'anon-a', {
    kind: 'coffee.select',
    cardIndex: 2,
  }, 1_000);
  expect(next.selections).toEqual({ ...coffeeState.selections, 'anon-a': 2 });
  expect(next.lastActor).toBe('anon-a');
  expect(next.revision).toBe(coffeeState.revision + 1);
});

it('allows only the current hot-potato holder to pass to an existing player', () => {
  expect(() => applyParticipantCommand('hot_potato', hotPotatoState, 'anon-b', {
    kind: 'hot_potato.pass',
    toActorId: 'anon-c',
    atMs: 5_000,
  }, 5_000)).toThrow('MUTATION_NOT_ALLOWED');
});
```

- [ ] **Step 2: Run authorization tests and verify they fail**

Run: `pnpm.cmd test:worker -- workers/realtime/test/authorization.test.ts`

Expected: FAIL because authorization functions are absent.

- [ ] **Step 3: Implement participant session issuance**

`POST /rooms/:roomId/join` accepts `{ actorId }`, verifies capacity against current WebSocket attachments, creates 32 random bytes, stores `{ actorId, SHA-256(token), createdAt }`, and returns `{ token, room }`. Rejoining the same actor rotates its token. Host creation inserts a `host` session for the creator.

- [ ] **Step 4: Implement host and participant mutation rules**

Host sessions may send complete `state_update` payloads with exact `expectedRevision`. Members may send only the five `ParticipantCommand` variants. Validate coffee card indices against the current deck and validate hot-potato joins, nickname length 1-20, readiness, current holder, destination membership, cooldown, and running status before deriving the next server state.

- [ ] **Step 5: Add stale revision and cross-actor rejection tests**

Verify `409 STALE_REVISION` includes the latest snapshot. Verify a member token for `anon-a` cannot authenticate as `anon-b`, alter another coffee selection, start/reset a game, change configuration, or pass a bomb it does not hold.

- [ ] **Step 6: Run Worker tests**

Run: `pnpm.cmd test:worker`

Expected: all tests pass.

- [ ] **Step 7: Commit authorization**

```powershell
git add workers/realtime
git commit -m "feat: authorize realtime room participants"
```

---

### Task 4: Hibernatable WebSockets, Presence, and Chat

**Files:**
- Modify: `workers/realtime/src/room.ts`
- Create: `workers/realtime/test/websocket.test.ts`

**Interfaces:**
- Consumes: `ClientEvent<TState>` and session hashes.
- Produces: v1 `ServerEvent<TState>` messages, persisted chat, Presence snapshots, and request acknowledgements.

- [ ] **Step 1: Write failing WebSocket integration tests**

Test that authentication is the first accepted event, state changes broadcast to two sockets, attachments survive `evictDurableObject()`, disconnect removes Presence, and `runDurableObjectAlarm()` emits expiry and clears SQL rows.

```ts
const first = await connectTestSocket(roomId);
const second = await connectTestSocket(roomId);
first.send(JSON.stringify(authEvent(host)));
second.send(JSON.stringify(authEvent(member)));
await expectMessage(first, 'authenticated');
await expectMessage(second, 'authenticated');
expect((await expectMessage(first, 'presence_updated')).members).toHaveLength(2);
```

- [ ] **Step 2: Write failing chat limit tests**

Send 6 messages from one actor inside 10 seconds and expect five `chat_added` events followed by `429 CHAT_RATE_LIMITED`. Insert 201 valid messages and verify only the newest 200 remain. Verify 501 characters returns `400 CHAT_TOO_LONG`.

- [ ] **Step 3: Run WebSocket tests and verify failures**

Run: `pnpm.cmd test:worker -- workers/realtime/test/websocket.test.ts`

Expected: FAIL because socket handlers and chat SQL are absent.

- [ ] **Step 4: Implement hibernatable connection lifecycle**

Use `ctx.acceptWebSocket(server)`. Store `{ authenticated, actorId, role, presence }` with `serializeAttachment`; rebuild Presence from `ctx.getWebSockets()` and each attachment after hibernation. Reject all non-authentication events from unauthenticated sockets with `403 ROOM_SESSION_REQUIRED`.

- [ ] **Step 5: Implement ordered state and participant command broadcasts**

Run authorization, persist the new state and revision in one SQLite transaction, then broadcast `state_updated`. Echo `requestId` so the sender resolves its promise. Broadcast errors only to the sender and include the latest snapshot for stale revisions.

- [ ] **Step 6: Implement durable bounded chat**

Count the actor's rows newer than `now - 10_000`, insert only when below five, delete rows outside the newest 200 in the same transaction, and broadcast the stored message. Load the newest 200 messages into each authenticated socket's initial `snapshot`.

- [ ] **Step 7: Run Worker tests and local type generation**

Run: `pnpm.cmd test:worker`

Expected: all tests pass.

Run: `pnpm.cmd wrangler types workers/realtime/worker-configuration.d.ts --config workers/realtime/wrangler.jsonc`

Expected: Worker bindings generate without errors.

- [ ] **Step 8: Commit realtime transport**

```powershell
git add workers/realtime
git commit -m "feat: add durable WebSocket rooms and chat"
```

---

### Task 5: Browser Client, Sessions, and React Room Hook

**Files:**
- Create: `lib/realtime/env.ts`
- Create: `lib/realtime/session.ts`
- Create: `lib/realtime/client.ts`
- Create: `lib/realtime/useRealtimeRoom.ts`
- Create: `lib/realtime/client.test.ts`
- Modify: `lib/realtime/rooms.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: public Worker endpoints and protocol v1 events.
- Produces: `hasRealtimeConfig()`, `createRoom<T>()`, `getRoom<T>()`, `joinRoom<T>()`, `connectRoom<T, TPresence>()`, and `useRealtimeRoom<T, TPresence>()`.

```ts
interface UseRealtimeRoomOptions<TState, TPresence> {
  roomId: string | null;
  actorId: string;
  initialPresence: TPresence;
  onState: (state: TState) => void;
}

interface UseRealtimeRoomResult<TState, TPresence> {
  room: RoomSnapshot<TState> | null;
  members: Array<{ actorId: string; presence: TPresence }>;
  messages: ChatMessage[];
  status: 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'expired' | 'error';
  updateState: (state: TState, expectedRevision: number) => Promise<TState>;
  sendCommand: (command: ParticipantCommand, expectedRevision: number) => Promise<TState>;
  updatePresence: (presence: TPresence) => void;
  sendChat: (text: string) => Promise<void>;
}
```

- [ ] **Step 1: Write failing client tests with fake fetch, storage, and WebSocket**

Verify API URL normalization, host token storage after creation, participant token rotation after join, first socket authentication event, `requestId` acknowledgement, exponential reconnect delays capped at 10 seconds, and a fresh snapshot after reconnect.

- [ ] **Step 2: Run client tests and verify failures**

Run: `pnpm.cmd test -- lib/realtime/client.test.ts`

Expected: FAIL because client modules are absent.

- [ ] **Step 3: Implement environment and room-scoped token storage**

Use keys `realtime:host-token:<roomId>` and `realtime:member-token:<roomId>:<actorId>`. Return no realtime configuration unless `NEXT_PUBLIC_REALTIME_API_URL` is a valid `http:` or `https:` URL.

- [ ] **Step 4: Implement typed HTTP calls and WebSocket request correlation**

Convert `https:` to `wss:` and `http:` to `ws:` only when building the socket URL. Authenticate in the first message, not the URL. Maintain a `Map<requestId, { resolve, reject }>` and reject pending operations if the room expires or the connection closes permanently.

- [ ] **Step 5: Implement reconnect and React cleanup**

Reconnect after 250, 500, 1,000, 2,000, 4,000, 8,000, then 10,000 ms while mounted. Reset the delay after `authenticated`, request a complete snapshot on every new connection, and close sockets and timers on unmount or room change.

- [ ] **Step 6: Preserve existing room helper behavior**

Keep `normalizeRoomId`, room name/capacity sanitation, game labels, and the client-side creation guard in `rooms.ts`; replace all Supabase CRUD with calls to `client.ts`. Change returned room fields to the camelCase `RoomSnapshot<TState>` contract and update callers in later tasks.

- [ ] **Step 7: Run client tests, lint, and build**

Run: `pnpm.cmd test -- lib/realtime/client.test.ts`

Expected: PASS.

Run: `pnpm.cmd lint`

Expected: no errors.

Run: `pnpm.cmd build`

Expected: successful Next.js production build.

- [ ] **Step 8: Commit the browser adapter**

```powershell
git add lib/realtime package.json pnpm-lock.yaml
git commit -m "feat: add Cloudflare realtime browser client"
```

---

### Task 6: Roulette Cutover and Shared Room Panel

**Files:**
- Modify: `app/roulette/page.tsx`
- Modify: `components/realtime/RoomSharePanel.tsx`
- Create: `e2e/realtime-roulette.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes: `createRoom`, `useRealtimeRoom`, `hasRealtimeConfig`.
- Produces: the first end-to-end Cloudflare room flow and reusable panel props for the remaining games.

- [ ] **Step 1: Write the failing two-browser roulette test**

```ts
test('shares and restores one roulette result', async ({ browser }) => {
  const host = await browser.newContext();
  const viewer = await browser.newContext();
  const hostPage = await host.newPage();
  await hostPage.goto('/roulette');
  await hostPage.getByRole('button', { name: '방 만들기' }).click();
  const roomUrl = hostPage.url();
  const viewerPage = await viewer.newPage();
  await viewerPage.goto(roomUrl);
  await hostPage.getByRole('button', { name: /다음|시작/ }).click();
  await expect(viewerPage.getByTestId('roulette-result')).toHaveText(await hostPage.getByTestId('roulette-result').innerText());
  await viewerPage.reload();
  await expect(viewerPage.getByTestId('roulette-result')).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test and confirm it fails on the Supabase path**

Run: `pnpm.cmd test:e2e -- e2e/realtime-roulette.spec.ts`

Expected: FAIL because no Cloudflare room client is connected to the page.

- [ ] **Step 3: Replace roulette's Supabase effects and optimistic broadcast**

Use `useRealtimeRoom<RouletteGameState, Record<string, never>>`. Host actions call `updateState(nextState, previous.revision)` and let the Durable Object broadcast the canonical result. Remove `sendStateRef`, `subscribeRoomState`, `updateRoomState`, and `hasSupabaseConfig` imports.

- [ ] **Step 4: Make RoomSharePanel transport-agnostic**

Replace internal Supabase Presence with props `presenceActors`, `messages`, `connectionStatus`, and `onSendChat`. Change missing configuration copy to “실시간 서버 설정이 필요합니다.” Show connecting/reconnecting/expired states without disabling local play.

- [ ] **Step 5: Verify host permission and result restoration**

Extend the E2E test so the viewer cannot trigger host controls, then reload the viewer after the result and compare exact displayed text.

- [ ] **Step 6: Run focused verification**

Run: `pnpm.cmd test:e2e -- e2e/realtime-roulette.spec.ts`

Expected: PASS.

Run: `pnpm.cmd lint`

Expected: no errors.

- [ ] **Step 7: Commit roulette cutover**

```powershell
git add app/roulette/page.tsx components/realtime/RoomSharePanel.tsx e2e playwright.config.ts
git commit -m "feat: migrate roulette rooms to Cloudflare"
```

---

### Task 7: Coffee Participant Commands

**Files:**
- Modify: `app/coffee/page.tsx`
- Create: `e2e/realtime-coffee.spec.ts`

**Interfaces:**
- Consumes: `useRealtimeRoom<CoffeeGameState, { cardIndex: number | null }>` and `coffee.select` commands.
- Produces: Cloudflare-backed host state, participant card selection, result sharing, and Presence metadata.

- [ ] **Step 1: Write the failing two-participant coffee test**

Create a room, join from a second browser, choose a card as the participant, verify only that actor's selection changes on the host, and verify the final coffee result survives participant refresh.

- [ ] **Step 2: Run the coffee E2E test and verify failure**

Run: `pnpm.cmd test:e2e -- e2e/realtime-coffee.spec.ts`

Expected: FAIL while the page still uses Supabase channels.

- [ ] **Step 3: Replace state and Presence channels**

Host step/result changes use `updateState`; participant selection uses `sendCommand({ kind: 'coffee.select', cardIndex }, revision)`. Use `updatePresence({ cardIndex })` only for active hover/selection display and treat the Durable Object state as the refresh-safe selection source.

- [ ] **Step 4: Remove all coffee Supabase imports and channel refs**

Delete `supabase`, `subscribeRoomState`, `updateRoomState`, `sendStateRef`, and `presenceChannelRef` usage. Feed hook members into `RoomSharePanel`.

- [ ] **Step 5: Run E2E, lint, and build**

Run: `pnpm.cmd test:e2e -- e2e/realtime-coffee.spec.ts`

Expected: PASS.

Run: `pnpm.cmd lint && pnpm.cmd build`

Expected: both commands exit 0.

- [ ] **Step 6: Commit coffee cutover**

```powershell
git add app/coffee/page.tsx e2e/realtime-coffee.spec.ts
git commit -m "feat: migrate coffee rooms to Cloudflare"
```

---

### Task 8: Team Split and Hot Potato Cutover

**Files:**
- Modify: `app/team-split/page.tsx`
- Modify: `app/hot-potato/page.tsx`
- Create: `e2e/realtime-team-split.spec.ts`
- Create: `e2e/realtime-hot-potato.spec.ts`

**Interfaces:**
- Consumes: host `updateState`, `hot_potato.join`, `hot_potato.rename`, `hot_potato.ready`, and `hot_potato.pass` commands.
- Produces: the final two Cloudflare-backed games with no direct provider calls.

- [ ] **Step 1: Write failing Team Split host/viewer test**

Verify team count, member list, shuffled result, and refresh restoration while viewer mutation controls remain unavailable.

- [ ] **Step 2: Write failing Hot Potato participant test**

Join two browsers, ready both players, start as host, pass from the current holder, verify a non-holder pass is rejected, and verify reconnect restores holder and timer timestamps.

- [ ] **Step 3: Run both E2E tests and verify Supabase-path failures**

Run: `pnpm.cmd test:e2e -- e2e/realtime-team-split.spec.ts e2e/realtime-hot-potato.spec.ts`

Expected: both fail before migration.

- [ ] **Step 4: Migrate Team Split to host state updates**

Replace room fetch/subscription/update calls with the common hook. Keep existing revision conflict UI but source the latest snapshot from `STALE_REVISION` errors. Remove Supabase configuration checks.

- [ ] **Step 5: Migrate Hot Potato to server participant commands**

Map join, nickname, ready, and pass handlers to exact participant commands. Keep start, reset, config, forced end, and timer authority as host `updateState` actions. Replace the separate Presence channel with hook members and preserve `isEndAuthority` calculation from connected actors.

- [ ] **Step 6: Run focused and full verification**

Run: `pnpm.cmd test:e2e -- e2e/realtime-team-split.spec.ts e2e/realtime-hot-potato.spec.ts`

Expected: PASS.

Run: `pnpm.cmd test:worker && pnpm.cmd test && pnpm.cmd lint && pnpm.cmd build`

Expected: every command exits 0.

- [ ] **Step 7: Commit both games**

```powershell
git add app/team-split/page.tsx app/hot-potato/page.tsx e2e
git commit -m "feat: migrate multiplayer rooms to Cloudflare"
```

---

### Task 9: Shared Room Chat and Expiry UX

**Files:**
- Create: `components/realtime/RoomChat.tsx`
- Modify: `components/realtime/RoomSharePanel.tsx`
- Create: `e2e/realtime-chat.spec.ts`

**Interfaces:**
- Consumes: `ChatMessage[]`, `sendChat(text)`, `connectionStatus`, and `expiresAt` from the room hook.
- Produces: accessible bounded chat UI and consistent expiry handling in every game.

- [ ] **Step 1: Write the failing chat E2E test**

Open one room in two browser contexts, send Korean text from each side, verify ordered delivery, reload one side, and verify persisted messages return. Send 501 characters and verify the UI prevents submission.

- [ ] **Step 2: Run the chat test and verify UI absence**

Run: `pnpm.cmd test:e2e -- e2e/realtime-chat.spec.ts`

Expected: FAIL because chat controls do not exist.

- [ ] **Step 3: Implement RoomChat**

Use a labeled 500-character textarea, submit button, remaining-character count, `aria-live` error/status region, chronological message list, actor aliases, and auto-scroll only when the user is already near the bottom. Disable sending while disconnected but keep cached messages visible.

- [ ] **Step 4: Integrate chat and expiry in RoomSharePanel**

Show the exact expiration time, reconnect state, combined “방을 찾을 수 없거나 만료된 링크예요” copy for 404/410, and the chat component only inside an active room.

- [ ] **Step 5: Run chat, accessibility, and build verification**

Run: `pnpm.cmd test:e2e -- e2e/realtime-chat.spec.ts`

Expected: PASS.

Run: `pnpm.cmd lint && pnpm.cmd build`

Expected: both commands exit 0.

- [ ] **Step 6: Commit chat UI**

```powershell
git add components/realtime e2e/realtime-chat.spec.ts
git commit -m "feat: add expiring realtime room chat"
```

---

### Task 10: Supabase Removal, Deployment Documentation, and Final Verification

**Files:**
- Delete: `lib/realtime/channel.ts`
- Delete: `lib/supabase/client.ts`
- Delete: `lib/supabase/env.ts`
- Delete: `docs/supabase-rls-guide.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `.gitignore`
- Create: `docs/cloudflare-realtime-deploy.md`

**Interfaces:**
- Consumes: all completed Cloudflare implementations and test suites.
- Produces: a Supabase-free application and reproducible Cloudflare deployment instructions.

- [ ] **Step 1: Add a dependency guard that fails while Supabase remains**

Run:

```powershell
rg -n "@supabase|NEXT_PUBLIC_SUPABASE|supabase\.channel|from\('rooms'\)" app components lib package.json README.md
```

Expected before cleanup: matches in Supabase modules and package metadata.

- [ ] **Step 2: Remove Supabase modules, package, environment copy, and obsolete RLS guide**

Run: `pnpm.cmd remove @supabase/supabase-js`

Delete the obsolete files only after `rg` confirms no application imports remain. Keep the historical migration design and implementation plan.

- [ ] **Step 3: Write deployment documentation**

Document `pnpm realtime:deploy`, Cloudflare login, Durable Object migrations, `ALLOWED_ORIGINS=https://ddangkong.suulab.xyz`, the Netlify `NEXT_PUBLIC_REALTIME_API_URL`, local Wrangler startup, rollback by redeploying the previous known-good frontend commit, usage dashboards, and the 70% free-limit upgrade threshold.

- [ ] **Step 4: Verify no Supabase dependency remains**

Run:

```powershell
rg -n "@supabase|NEXT_PUBLIC_SUPABASE|supabase\.channel|from\('rooms'\)" app components lib package.json README.md
```

Expected: no matches and exit code 1.

- [ ] **Step 5: Run the complete automated suite**

Run: `pnpm.cmd test:worker`

Expected: all Worker tests pass.

Run: `pnpm.cmd test`

Expected: all unit tests pass.

Run: `pnpm.cmd test:e2e`

Expected: all five realtime browser specs pass.

Run: `pnpm.cmd lint`

Expected: no errors.

Run: `pnpm.cmd build`

Expected: successful production build.

- [ ] **Step 6: Inspect the final diff and commit cleanup**

```powershell
git diff --check
git status --short
git add package.json pnpm-lock.yaml README.md .gitignore docs app components lib workers e2e playwright.config.ts
git commit -m "chore: remove Supabase realtime dependencies"
```

- [ ] **Step 7: Perform the deployment smoke test after credentials are available**

Deploy the Worker, set the Netlify public API URL, open one production roulette room in two browser contexts, verify shared result and chat, reload the viewer, and confirm the result persists. If the smoke test fails, restore the prior frontend deployment while keeping the failed Worker version available for diagnosis.
