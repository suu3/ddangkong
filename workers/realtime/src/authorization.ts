import {
  GameState,
  GameType,
  ParticipantCommand,
  isRecord,
  validActor,
  validCard,
  validRevision,
} from '../../../src/shared/api/realtime-protocol';

const fail = (code = 'INVALID_STATE'): never => {
  throw new Error(code);
};
const integer = (n: unknown, min: number, max: number) =>
  Number.isSafeInteger(n) && Number(n) >= min && Number(n) <= max;
export function validateState(game: GameType, input: unknown): asserts input is GameState {
  if (!isRecord(input) || !validRevision(input.revision) || !(input.lastActor === null || validActor(input.lastActor)))
    fail();
  const s = input as any;
  if (game === 'roulette') {
    if (
      !integer(s.step, 0, 3) ||
      !isRecord(s.orderState) ||
      !Number.isFinite(s.orderState.angle) ||
      !Array.isArray(s.orderState.total) ||
      s.orderState.total.length > 100 ||
      !s.orderState.total.every((x: unknown) => typeof x === 'string' && x.length <= 200) ||
      !(s.resultIndex === null || integer(s.resultIndex, 0, s.orderState.total.length - 1))
    )
      fail();
  } else if (game === 'coffee') {
    if (
      !integer(s.step, 0, 4) ||
      !isRecord(s.orderState) ||
      !integer(s.orderState.total, 0, 100) ||
      !integer(s.orderState.boom, 0, Number(s.orderState.total)) ||
      !(s.result === null || (typeof s.result === 'string' && s.result.length <= 1000))
    )
      fail();
    if (
      s.selections !== undefined &&
      (!isRecord(s.selections) ||
        Object.entries(s.selections).some(([actor, card]) => !validActor(actor) || !validCard(card)))
    )
      fail();
  } else if (game === 'team_split') {
    if (
      !validActor(s.hostId) ||
      !Array.isArray(s.members) ||
      s.members.length > 100 ||
      !s.members.every((x: unknown) => typeof x === 'string' && x.length <= 100) ||
      ![2, 3, 4].includes(s.teamCount) ||
      !Array.isArray(s.result) ||
      s.result.length > 4 ||
      !s.result.every(
        (x: unknown) => Array.isArray(x) && x.length <= 100 && x.every(y => typeof y === 'string' && y.length <= 100)
      ) ||
      !(s.lastShuffledAt === null || Number.isFinite(s.lastShuffledAt))
    )
      fail();
  } else {
    if (
      !validActor(s.hostId) ||
      !Array.isArray(s.players) ||
      s.players.length > 20 ||
      !s.players.every(
        (p: any) =>
          isRecord(p) &&
          validActor(p.userId) &&
          typeof p.nickname === 'string' &&
          p.nickname.length >= 1 &&
          p.nickname.length <= 20 &&
          typeof p.isReady === 'boolean' &&
          typeof p.isSpectator === 'boolean'
      ) ||
      new Set(s.players.map((p: any) => p.userId)).size !== s.players.length ||
      !isRecord(s.game)
    )
      fail();
    const g = s.game;
    if (
      !['idle', 'running', 'ended'].includes(g.status) ||
      !integer(g.roundId, 0, 1000000) ||
      !isRecord(g.config) ||
      ![15, 30, 60].includes(g.config.durationSec) ||
      !integer(g.config.cooldownMs, 100, 10000) ||
      typeof g.config.hostOnlyPass !== 'boolean' ||
      typeof g.config.allowSelfPass !== 'boolean' ||
      !integer(g.config.antiRepeatWindow, 0, 20) ||
      g.config.lateJoinPolicy !== 'spectator' ||
      !Array.isArray(g.lastHolders) ||
      g.lastHolders.length > 20 ||
      !g.lastHolders.every(validActor) ||
      !Array.isArray(g.history) ||
      g.history.length > 100 ||
      !Array.isArray(g.processedActionIds) ||
      g.processedActionIds.length > 100
    )
      fail();
    if (
      g.status === 'running' &&
      (!Number.isFinite(g.startedAtMs) ||
        !Number.isFinite(g.endsAtMs) ||
        g.endsAtMs <= g.startedAtMs ||
        !s.players.some((p: any) => p.userId === g.holderUserId && !p.isSpectator))
    )
      fail();
  }
}
export function authorizeStateUpdate(role: string) {
  if (role !== 'host') fail('HOST_PERMISSION_REQUIRED');
}

export function applyCommand(
  game: GameType,
  state: GameState,
  actor: string,
  command: ParticipantCommand,
  now: number,
  capacity: number,
  connectedActorIds?: ReadonlySet<string>
): GameState {
  const s = structuredClone(state) as any;
  if (game === 'coffee' && command.kind === 'coffee.select') {
    if (s.step < 2 || (command.cardIndex !== null && (command.cardIndex < 1 || command.cardIndex > s.orderState.total)))
      fail('MUTATION_NOT_ALLOWED');
    s.selections = { ...s.selections, [actor]: command.cardIndex };
    return s;
  }
  if (game !== 'hot_potato') fail('MUTATION_NOT_ALLOWED');
  const player = s.players.find((p: any) => p.userId === actor);
  if (command.kind === 'hot_potato.join') {
    if (player) return s;
    if (s.players.length >= capacity) fail('ROOM_FULL');
    let nickname = command.nickname.trim();
    if (s.players.some((p: any) => p.nickname === nickname)) nickname = `${nickname.slice(0, 14)}-${actor.slice(-4)}`;
    s.players.push({ userId: actor, nickname, isReady: command.isReady, isSpectator: s.game.status === 'running' });
    return s;
  }
  if (!player) fail('MUTATION_NOT_ALLOWED');
  if (command.kind === 'hot_potato.rename') {
    const name = command.nickname.trim();
    player.nickname = s.players.some((p: any) => p.userId !== actor && p.nickname === name)
      ? `${name.slice(0, 14)}-${actor.slice(-4)}`
      : name;
  } else if (command.kind === 'hot_potato.ready') {
    if (s.game.status === 'running') fail('MUTATION_NOT_ALLOWED');
    player.isReady = command.isReady;
  } else if (command.kind === 'hot_potato.pass') {
    const g = s.game;
    if (
      g.status !== 'running' ||
      now >= g.endsAtMs ||
      g.holderUserId !== actor ||
      (g.config.hostOnlyPass && s.hostId !== actor)
    )
      fail('MUTATION_NOT_ALLOWED');
    if (g.lastPassAtMs && now - g.lastPassAtMs < g.config.cooldownMs) fail('COOLDOWN');
    const candidates = s.players.filter(
      (p: any) =>
        !p.isSpectator &&
        (!connectedActorIds || connectedActorIds.has(p.userId)) &&
        (g.config.allowSelfPass || p.userId !== actor)
    );
    const recent = g.config.antiRepeatWindow ? g.lastHolders.slice(-g.config.antiRepeatWindow) : [];
    const fresh = candidates.filter((p: any) => !recent.includes(p.userId));
    const pool = fresh.length ? fresh : candidates;
    if (!pool.length) fail('MUTATION_NOT_ALLOWED');
    g.holderUserId = pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length].userId;
    g.lastPassAtMs = now;
    g.lastHolders = [...g.lastHolders, g.holderUserId].slice(-20);
  } else fail('MUTATION_NOT_ALLOWED');
  return s;
}
