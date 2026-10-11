import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameError } from '../poker/logic.ts';
import {
  type WeeklyBracket,
  WEEKLY_FIRST_TURN_MS,
  WEEKLY_MATCH_MAX_MS,
  WEEKLY_MAX_PLAYERS,
  matchKey,
  weeklyGames,
} from '../_shared/engine/index.ts';
import type { GameRoomRow } from './logic.ts';
import {
  type WeeklyRegistration,
  type WeeklyRow,
  advanceWeekly,
  championColumns,
  checkRegister,
  checkUnregister,
  hallOfFame,
  matchNotices,
  matchOutcome,
  matchOverdue,
  matchPlayers,
  matchRoom,
  newWeeklyRow,
  playOut,
  playingMatches,
  publicWeekly,
  registrationRow,
  rewardDue,
  startMatch,
  startWeekly,
  weeklyDue,
  weeklyRemindDue,
  withRoom,
} from './weekly.ts';

// Saturday 10 October 2026, noon in Paris.
const NOW = Date.parse('2026-10-10T10:00:00Z');
const START = Date.parse('2026-10-16T19:00:00Z');
let seed = 1;
const rng = (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};
let ids = 0;
const newId = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;

const row = (over: Partial<WeeklyRow> = {}): WeeklyRow => ({
  id: 'w1',
  friday: '2026-10-16',
  starts_at: new Date(START).toISOString(),
  game: 'puissance4',
  status: 'open',
  bracket: null,
  version: 0,
  reminded: false,
  winner_id: null,
  winner_name: null,
  winner_avatar: null,
  winner_avatar_color: null,
  winner_bot: null,
  players: 0,
  rewarded: false,
  ...over,
});

const regs = (n: number): WeeklyRegistration[] =>
  Array.from({ length: n }, (_, i) => ({
    user_id: `user-${String(i + 1).padStart(2, '0')}`,
    name: `Joueur ${i + 1}`,
    avatar: '🦊',
    avatar_color: '#e63946',
  }));

const roomOf = (weeklyId: string, game: string, m: Parameters<typeof matchRoom>[2]): GameRoomRow => ({
  id: `room-${matchKey(m)}`,
  code: `CODE${matchKey(m).replace('-', '')}`,
  status: 'lobby',
  version: 0,
  ...(matchRoom(weeklyId, game, m) as Omit<GameRoomRow, 'id' | 'code' | 'status' | 'version'>),
});

test('the next row is the coming Friday, its game from the rotation', () => {
  const r = newWeeklyRow(NOW);
  assert.equal(r.friday, '2026-10-16');
  assert.equal(r.starts_at, '2026-10-16T19:00:00.000Z');
  assert.ok(weeklyGames().includes(r.game));
});

test('the tournament is due at 21:00; the reminder goes in the 10 minutes before, once', () => {
  assert.ok(!weeklyDue(row(), START - 1));
  assert.ok(weeklyDue(row(), START));
  assert.ok(!weeklyDue(row({ status: 'running' }), START + 1));
  assert.ok(!weeklyRemindDue(row(), START - 11 * 60_000));
  assert.ok(weeklyRemindDue(row(), START - 9 * 60_000));
  assert.ok(!weeklyRemindDue(row({ reminded: true }), START - 9 * 60_000));
  assert.ok(!weeklyRemindDue(row(), START));
});

test('signing up: before the start, while there is room', () => {
  checkRegister(row(), 0, false, NOW);
  assert.throws(() => checkRegister(row(), 0, false, START), GameError);
  assert.throws(() => checkRegister(row({ status: 'running' }), 0, false, NOW), /closes/);
  assert.throws(() => checkRegister(row(), WEEKLY_MAX_PLAYERS, false, NOW), /complet/);
  // Already signed up: may still change their name when full.
  checkRegister(row(), WEEKLY_MAX_PLAYERS, true, NOW);
  checkUnregister(row(), NOW);
  assert.throws(() => checkUnregister(row(), START + 1), /commencé/);
});

test('a sign-up keeps a clean name and an allowed avatar', () => {
  const r = registrationRow('w1', 'u1', { name: '  Zoé  ', avatar: { emoji: '🐉', color: '#000' } }, []);
  assert.equal(r.name, 'Zoé');
  assert.notEqual(r.avatar, '🐉'); // locked emoji
  assert.throws(() => registrationRow('w1', 'u1', { name: '' }, []), GameError);
});

test('nobody signed up: cancelled; otherwise a bracket filled with robots', () => {
  assert.deepEqual(startWeekly([], rng, newId), { status: 'cancelled', bracket: null, players: 0 });
  const s = startWeekly(regs(3), rng, newId);
  assert.equal(s.status, 'running');
  assert.equal(s.players, 3);
  const first = s.bracket!.rounds[0];
  assert.equal(first.length, 2);
  const seated = first.flatMap((m) => [m.a!, m.b!]);
  assert.equal(seated.filter((e) => e.bot).length, 1);
  assert.equal(seated.filter((e) => !e.bot).length, 3);
});

test('a match table: both players seated, a person hosts, more time for the first move', () => {
  const s = startWeekly(regs(2), rng, newId);
  const m = s.bracket!.rounds[0][0];
  const players = matchPlayers(m);
  assert.deepEqual(
    players.map((p) => p.seat),
    [0, 1],
  );
  const room = roomOf('w1', 'puissance4', m);
  assert.equal(room.weekly_match, '0-0');
  assert.ok([m.a!.id, m.b!.id].includes(room.host_id));
  const snap = startMatch(room, m, rng, NOW);
  assert.equal(snap.secret.seats.length, 2);
  assert.equal(snap.public.deadline, NOW + WEEKLY_FIRST_TURN_MS);
});

test('two robots never get a table', () => {
  const bots = {
    round: 1,
    slot: 0,
    a: { id: 'b1', name: 'Bip', bot: true },
    b: { id: 'b2', name: 'Zorg', bot: true },
    winner: null,
    by: null,
    roomId: null,
    code: null,
    readyAt: null,
  };
  assert.throws(() => matchRoom('w1', 'uno', bots), GameError);
});

test('every game of the rotation can be played out by the server and gives one winner', () => {
  for (const game of weeklyGames()) {
    const s = startWeekly(regs(2), rng, newId);
    const m = s.bracket!.rounds[0][0];
    const snap = startMatch(roomOf('w1', game, m), m, rng, NOW);
    assert.equal(matchOutcome(snap.secret, m, 0), null, game);
    const done = playOut(snap.secret, rng, NOW);
    assert.ok(done, `${game} ne finit pas`);
    const winner = matchOutcome(done.secret, m, rng(2));
    assert.ok(winner === m.a!.id || winner === m.b!.id, game);
  }
});

test('a table is played out only once it waited too long', () => {
  const m = { ...startWeekly(regs(2), rng, newId).bracket!.rounds[0][0], readyAt: NOW };
  assert.ok(!matchOverdue(m, NOW + WEEKLY_MATCH_MAX_MS - 1));
  assert.ok(matchOverdue(m, NOW + WEEKLY_MATCH_MAX_MS));
  assert.ok(!matchOverdue({ ...m, winner: m.a!.id }, NOW + WEEKLY_MATCH_MAX_MS));
});

/** Plays a whole tournament as the server would: tables open, end, the bracket moves on. */
function playTournament(count: number) {
  const s = startWeekly(regs(count), rng, newId);
  let bracket: WeeklyBracket | null = null;
  let next = s.bracket!;
  const notices: string[] = [];
  let champion = null;
  for (let step = 0; step < 50 && !champion; step++) {
    const results = playingMatches(next).map((m) => {
      const snap = playOut(startMatch(roomOf('w1', 'puissance4', m), m, rng, NOW).secret, rng, NOW)!;
      return { key: matchKey(m), winner: matchOutcome(snap.secret, m, 0)!, by: 'game' as const };
    });
    const adv = advanceWeekly(next, results, rng);
    let opened = adv.bracket;
    for (const m of adv.toOpen) {
      opened = withRoom(opened, matchKey(m), { id: `room-${matchKey(m)}`, code: `C${matchKey(m)}` }, NOW);
    }
    notices.push(...matchNotices(bracket ?? null, opened).map((n) => n.userId));
    bracket = opened;
    next = opened;
    champion = adv.champion;
  }
  return { bracket: next, champion, notices };
}

test('a whole tournament of 5 goes to the end, every person told when their match is ready', () => {
  const { bracket, champion, notices } = playTournament(5);
  assert.ok(champion);
  assert.equal(bracket.rounds.length, 3);
  // Each person is told about their first match, and again about each match they reach.
  for (const r of regs(5)) assert.ok(notices.includes(r.user_id));
  assert.equal(new Set(notices.filter((id) => id.startsWith('user-'))).size, 5);
  assert.ok(!notices.some((id) => !id.startsWith('user-')), 'robots are never notified');
  assert.deepEqual(playingMatches(bracket), []);
});

test('a single person plays a robot in the final', () => {
  const { bracket, champion } = playTournament(1);
  assert.equal(bracket.rounds.length, 1);
  assert.ok(champion);
});

test('a result already recorded is not changed by a later one', () => {
  const s = startWeekly(regs(2), rng, newId);
  const m = s.bracket!.rounds[0][0];
  const once = advanceWeekly(s.bracket!, [{ key: '0-0', winner: m.a!.id, by: 'game' }], rng);
  const twice = advanceWeekly(once.bracket, [{ key: '0-0', winner: m.b!.id, by: 'timeout' }], rng);
  assert.equal(twice.champion?.id, m.a!.id);
  assert.equal(twice.bracket.rounds[0][0].by, 'game');
});

test('the champion is rewarded once, and never a robot', () => {
  const champ = championColumns({ id: 'user-01', name: 'Joueur 1', bot: false }, NOW);
  const finished = row({ ...champ });
  assert.ok(rewardDue(finished));
  assert.ok(!rewardDue({ ...finished, rewarded: true }));
  assert.ok(!rewardDue(row({ ...championColumns({ id: 'b', name: 'Bip', bot: true }, NOW) })));
  assert.ok(!rewardDue(row({ status: 'running' })));
});

test('hall of fame: most titles first, robots counted by name', () => {
  const won = (friday: string, id: string, name: string, bot = false) =>
    row({ friday, status: 'finished', winner_id: id, winner_name: name, winner_bot: bot });
  const hall = hallOfFame([
    won('2026-09-04', 'a', 'Alice'),
    won('2026-09-11', 'b1', 'Bip', true),
    won('2026-09-18', 'b', 'Bob'),
    won('2026-09-25', 'a', 'Alice'),
    won('2026-10-02', 'b2', 'Bip', true),
    row({ friday: '2026-10-09', status: 'cancelled' }),
  ]);
  assert.deepEqual(
    hall.map((h) => [h.name, h.wins]),
    [
      ['Alice', 2],
      ['Bip', 2],
      ['Bob', 1],
    ],
  );
});

test('what the phone sees', () => {
  const view = publicWeekly(row(), regs(3), 'user-02');
  assert.equal(view.registered, 3);
  assert.equal(view.me, true);
  assert.equal(view.startsAt, START);
  assert.equal(view.winner, null);
  assert.equal((view as Record<string, unknown>).version, undefined);
});
