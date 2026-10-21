/** Traditional drawing telephone rules. Private state never crosses the transport boundary. */
export const RELAY_COLORS = ['#3d3131', '#d45b55', '#e3ad38', '#538461', '#5479b4', '#9a6ba5'] as const;
export interface Stroke {
  tool: 'pen' | 'eraser';
  color: string;
  width: number;
  points: [number, number][];
}
export interface Drawing {
  strokes: Stroke[];
}
export type RelayContent = string | Drawing;
export type RelayEntry = { authorId: string; autoSubmitted: boolean } & (
  | { kind: 'text'; text: string }
  | { kind: 'drawing'; drawing: Drawing }
);
export interface RelayPlayer {
  actorId: string;
  nickname: string;
  ready: boolean;
}
export type RelayPhase = 'lobby' | 'playing' | 'reveal' | 'complete';
export interface RelayPrivateState {
  [key: string]: unknown;
  revision: number;
  lastActor: string | null;
  hostId: string;
  gameId: string;
  players: RelayPlayer[];
  order: string[];
  phase: RelayPhase;
  round: number;
  deadlineMs: number | null;
  chains: RelayEntry[][];
  drafts: Record<string, RelayContent>;
  submitted: string[];
  revealCursor: number;
}
export interface RelayPublicState {
  [key: string]: unknown;
  revision: number;
  lastActor: string | null;
  hostId: string;
  gameId: string;
  players: RelayPlayer[];
  order: string[];
  phase: RelayPhase;
  round: number;
  deadlineMs: number | null;
  serverNow: number;
  submitted: string[];
  revealCursor: number;
  ownDraft: RelayContent | null;
  ownSubmitted: boolean;
  previousEntry: RelayEntry | null;
  revealedChains: RelayEntry[][];
}
export type RelayCommand =
  | { kind: 'join' | 'rename'; nickname: string }
  | { kind: 'ready'; ready: boolean }
  | { kind: 'start' | 'reveal-next' | 'reset' }
  | { kind: 'draft' | 'submit'; gameId: string; round: number; content: RelayContent };
const fail = (code: string): never => {
  throw new Error(code);
};
const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
export const assignedActor = (order: string[], chain: number, round: number): string =>
  order[(chain + round) % order.length];
export const entryKind = (round: number): 'text' | 'drawing' => (round % 2 ? 'drawing' : 'text');
export const roundDurationMs = (round: number): number => (round % 2 ? 60_000 : 30_000);
export function validateDrawing(input: unknown): Drawing {
  if (!record(input) || !Array.isArray(input.strokes) || input.strokes.length > 120) return fail('INVALID_DRAWING');
  let count = 0;
  const strokes: Stroke[] = input.strokes.map((s: unknown) => {
    if (
      !record(s) ||
      !['pen', 'eraser'].includes(String(s.tool)) ||
      !RELAY_COLORS.includes(s.color as (typeof RELAY_COLORS)[number]) ||
      typeof s.width !== 'number' ||
      !Number.isFinite(s.width) ||
      s.width < 0.002 ||
      s.width > 0.08 ||
      !Array.isArray(s.points) ||
      !s.points.length
    )
      return fail('INVALID_DRAWING');
    count += s.points.length;
    if (count > 2000) return fail('INVALID_DRAWING');
    const points: [number, number][] = s.points.map((p: unknown) => {
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)
      )
        return fail('INVALID_DRAWING');
      return [p[0] as number, p[1] as number];
    });
    return { tool: s.tool as Stroke['tool'], color: s.color as string, width: s.width, points };
  });
  const result = { strokes };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 48 * 1024) fail('INVALID_DRAWING');
  return result;
}
export function parseRelayCommand(value: unknown): RelayCommand {
  if (!record(value)) return fail('INVALID_MESSAGE');
  const kind = value.kind;
  if (kind === 'join' || kind === 'rename') {
    if (typeof value.nickname !== 'string' || !value.nickname.trim() || value.nickname.length > 20)
      return fail('INVALID_NICKNAME');
    return { kind, nickname: value.nickname.trim() };
  }
  if (kind === 'ready' && typeof value.ready === 'boolean') return { kind, ready: value.ready };
  if (kind === 'start' || kind === 'reveal-next' || kind === 'reset') return { kind };
  if (
    (kind === 'draft' || kind === 'submit') &&
    typeof value.gameId === 'string' &&
    value.gameId.length <= 80 &&
    Number.isSafeInteger(value.round) &&
    Number(value.round) >= 0 &&
    Number(value.round) < 10
  ) {
    const content = typeof value.content === 'string' ? value.content : validateDrawing(value.content);
    if (typeof content === 'string' && content.length > 100) return fail('INVALID_CONTENT');
    return { kind, gameId: value.gameId, round: Number(value.round), content };
  }
  return fail('INVALID_MESSAGE');
}
export function createRelay(hostId: string, _now: number): RelayPrivateState {
  return {
    revision: 0,
    lastActor: null,
    hostId,
    gameId: crypto.randomUUID(),
    players: [],
    order: [],
    phase: 'lobby',
    round: 0,
    deadlineMs: null,
    chains: [],
    drafts: {},
    submitted: [],
    revealCursor: 0,
  };
}
function nextRound(s: RelayPrivateState, now: number) {
  s.drafts = {};
  s.submitted = [];
  if (s.round + 1 === s.order.length) {
    s.phase = 'reveal';
    s.deadlineMs = null;
  } else {
    s.round++;
    s.deadlineMs = now + roundDurationMs(s.round);
  }
}
function addEntry(s: RelayPrivateState, actor: string, content: RelayContent, autoSubmitted: boolean) {
  const chain = s.order.findIndex((_, c) => assignedActor(s.order, c, s.round) === actor);
  const entry: RelayEntry =
    typeof content === 'string'
      ? { kind: 'text', text: content, authorId: actor, autoSubmitted }
      : { kind: 'drawing', drawing: content, authorId: actor, autoSubmitted };
  s.chains[chain].push(entry);
  s.submitted.push(actor);
  delete s.drafts[actor];
}
export function advanceRelayDeadline(state: RelayPrivateState, now: number): RelayPrivateState {
  if (state.phase !== 'playing' || state.deadlineMs === null || now < state.deadlineMs) return state;
  const s = structuredClone(state);
  for (const actor of s.order)
    if (!s.submitted.includes(actor))
      addEntry(s, actor, s.drafts[actor] ?? (entryKind(s.round) === 'text' ? '' : { strokes: [] }), true);
  nextRound(s, now);
  s.revision++;
  s.lastActor = null;
  return s;
}
export function applyRelayCommand(
  state: RelayPrivateState,
  actor: string,
  raw: RelayCommand,
  now: number
): RelayPrivateState {
  const cmd = parseRelayCommand(raw);
  const s = structuredClone(state);
  if (['start', 'reset', 'reveal-next'].includes(cmd.kind) && actor !== s.hostId) fail('HOST_PERMISSION_REQUIRED');
  const player = s.players.find(p => p.actorId === actor);
  if (cmd.kind === 'join') {
    if (player) return state;
    if (s.phase !== 'lobby') fail('GAME_STARTED');
    if (s.players.length >= 10) fail('ROOM_FULL');
    s.players.push({ actorId: actor, nickname: cmd.nickname, ready: false });
  } else {
    if (!player) return fail('NOT_A_PLAYER');
    if (cmd.kind === 'rename' || cmd.kind === 'ready') {
      if (s.phase !== 'lobby') fail('GAME_STARTED');
      if (cmd.kind === 'rename') player.nickname = cmd.nickname;
      else if (cmd.kind === 'ready') player.ready = cmd.ready;
    } else if (cmd.kind === 'start') {
      if (s.phase !== 'lobby' || s.players.length < 4 || !s.players.every(p => p.ready)) fail('NOT_READY');
      s.order = s.players.map(p => p.actorId);
      s.chains = s.order.map(() => []);
      s.phase = 'playing';
      s.deadlineMs = now + 30_000;
    } else if (cmd.kind === 'reset') {
      if (s.phase !== 'complete') fail('MUTATION_NOT_ALLOWED');
      const reset = createRelay(s.hostId, now);
      Object.assign(s, reset, { players: s.players.map(p => ({ ...p, ready: false })), revision: state.revision });
    } else if (cmd.kind === 'reveal-next') {
      if (s.phase !== 'reveal') fail('MUTATION_NOT_ALLOWED');
      s.revealCursor++;
      if (s.revealCursor === s.order.length ** 2) s.phase = 'complete';
    } else if (cmd.kind === 'draft' || cmd.kind === 'submit') {
      if (s.phase !== 'playing' || s.gameId !== cmd.gameId || s.round !== cmd.round) fail('STALE_TURN');
      if (!s.order.includes(actor)) fail('NOT_A_PLAYER');
      if (s.deadlineMs === null || now >= s.deadlineMs) fail('TURN_EXPIRED');
      if (s.submitted.includes(actor)) return state;
      if ((entryKind(s.round) === 'text') !== (typeof cmd.content === 'string')) fail('INVALID_CONTENT');
      if (cmd.kind === 'draft') s.drafts[actor] = cmd.content;
      else {
        addEntry(s, actor, cmd.content, false);
        if (s.submitted.length === s.order.length) nextRound(s, now);
      }
    }
  }
  s.revision = state.revision + 1;
  s.lastActor = actor;
  return s;
}
export function projectRelay(s: RelayPrivateState, actor: string | null, now: number): RelayPublicState {
  const member = actor !== null && s.players.some(p => p.actorId === actor);
  const chain =
    member && s.order.length ? s.order.findIndex((_, c) => assignedActor(s.order, c, s.round) === actor) : -1;
  const revealing = s.phase === 'reveal' || s.phase === 'complete';
  return {
    revision: s.revision,
    lastActor: s.lastActor,
    hostId: s.hostId,
    gameId: s.gameId,
    players: actor === null ? [] : structuredClone(s.players),
    order: actor === null ? [] : [...s.order],
    phase: s.phase,
    round: s.round,
    deadlineMs: s.deadlineMs,
    serverNow: now,
    submitted: actor === null ? [] : [...s.submitted],
    revealCursor: s.revealCursor,
    ownDraft: member ? structuredClone(s.drafts[actor!] ?? null) : null,
    ownSubmitted: member && s.submitted.includes(actor!),
    previousEntry:
      member && s.phase === 'playing' && s.round > 0 && chain >= 0
        ? structuredClone(s.chains[chain][s.round - 1])
        : null,
    revealedChains:
      member && revealing
        ? s.chains.map((c, i) =>
            structuredClone(c.slice(0, Math.max(0, Math.min(s.order.length, s.revealCursor - i * s.order.length))))
          )
        : [],
  };
}
