import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameError } from '../poker/logic.ts';
import {
  type GamePlayerRow,
  type GameRoomRow,
  BOT_MS,
  TURN_MS,
  checkJoin,
  gameRematch,
  gameRematchJoin,
  cleanOptions,
  cleanTournamentGames,
  cleanTournamentName,
  tournamentResults,
  onlineResults,
  newGameBot,
  playGameMove,
  playGameTimeout,
  progressAwards,
  startGame,
} from './logic.ts';

const NOW = 1_000_000;
const rng = (n: number) => 0 % n;

const room = (over: Partial<GameRoomRow> = {}): GameRoomRow => ({
  id: 'room',
  code: 'ABCDEF',
  game: 'yams',
  host_id: 'a',
  options: {},
  status: 'lobby',
  version: 0,
  ...over,
});

const player = (user_id: string, seat: number, is_bot = false): GamePlayerRow => ({
  user_id,
  name: user_id.toUpperCase(),
  seat,
  is_bot,
});

let ids = 0;
const newId = () => `bot-${++ids}`;

test('a game the server does not know is refused', () => {
  assert.throws(() => cleanOptions('morpion', {}), GameError);
});

test('joining is refused once started, when full, or with a name already taken', () => {
  const players = [player('a', 0)];
  assert.throws(() => checkJoin(room({ status: 'playing' }), players, 'b', 'Bob'), /déjà commencé/);
  assert.throws(() => checkJoin(room(), players, 'b', 'a'), /déjà pris/);
  const six = [0, 1, 2, 3, 4, 5].map((s) => player(`p${s}`, s));
  assert.throws(() => checkJoin(room(), six, 'b', 'Bob'), /pleine/);
  checkJoin(room(), players, 'b', 'Bob');
});

test('only the host adds robots, on the first free seat', () => {
  assert.throws(() => newGameBot(room(), [player('a', 0)], 'b', 'x'), /créateur/);
  const bot = newGameBot(room(), [player('a', 0), player('b', 2)], 'a', 'x');
  assert.equal(bot.seat, 1);
  assert.equal(bot.is_bot, true);
});

test('starting gives each person their own view and the first turn to the first seat', () => {
  const { bots, snapshot } = startGame(room(), [player('b', 1), player('a', 0)], 'a', newId, rng, NOW);
  assert.equal(bots.length, 0);
  assert.deepEqual(
    snapshot.public.seats.map((s) => s.id),
    ['a', 'b'],
  );
  assert.deepEqual(snapshot.public.actors, ['a']);
  assert.equal(snapshot.public.deadline, NOW + TURN_MS);
  assert.deepEqual(Object.keys(snapshot.privates).sort(), ['a', 'b']);
});

test('only the host starts, and only once', () => {
  assert.throws(() => startGame(room(), [player('a', 0)], 'b', newId, rng, NOW), /créateur/);
  assert.throws(
    () => startGame(room({ status: 'playing' }), [player('a', 0)], 'a', newId, rng, NOW),
    /commencé/,
  );
});

test('a player can only move on their turn, and the move is applied', () => {
  const { snapshot } = startGame(room(), [player('a', 0), player('b', 1)], 'a', newId, rng, NOW);
  assert.throws(() => playGameMove(snapshot.secret, 'b', { type: 'roll' }, rng, NOW), /pas ton tour/);
  assert.throws(() => playGameMove(snapshot.secret, 'z', { type: 'roll' }, rng, NOW), /pas à cette table/);
  assert.throws(() => playGameMove(snapshot.secret, 'a', { type: 'cheat' }, rng, NOW), GameError);
  const next = playGameMove(snapshot.secret, 'a', { type: 'roll' }, rng, NOW);
  assert.equal((next.public.view as { rollCount: number }).rollCount, 1);
  assert.throws(() => playGameMove(snapshot.secret, 'a', { type: 'next' }, rng, NOW), /pas finie/);
});

test('robots play once their short pause is over, and a slow player is played for', () => {
  const { snapshot } = startGame(room(), [player('a', 0), player('r', 1, true)], 'a', newId, rng, NOW);
  assert.throws(() => playGameTimeout(snapshot.secret, rng, NOW + 10), /Pas encore/);
  let t = NOW + TURN_MS;
  let s = playGameTimeout(snapshot.secret, rng, t);
  // The person's turn goes on until they score, one automatic move at a time.
  while (s.public.actors[0] === 'a') s = playGameTimeout(s.secret, rng, (t = s.secret.deadline!));
  assert.deepEqual(s.public.actors, ['r']);
  assert.equal(s.secret.deadline, t + BOT_MS);
  while (s.public.actors[0] === 'r') s = playGameTimeout(s.secret, rng, s.secret.deadline!);
  assert.deepEqual(s.public.actors, ['a']);
});

test('robots fill the table when a game needs more players', () => {
  const { bots, snapshot } = startGame(room({ game: 'yams' }), [player('a', 0)], 'a', newId, rng, NOW);
  assert.equal(bots.length, 0);
  assert.equal(snapshot.public.seats.length, 1);
});

test('blackjack: everyone bets at once, robots first on timeout, the shoe stays secret', () => {
  const { snapshot } = startGame(
    room({ game: 'blackjack', options: cleanOptions('blackjack', { stack: 500 }) }),
    [player('a', 0), player('r', 1, true), player('b', 2)],
    'a',
    newId,
    rng,
    NOW,
  );
  assert.deepEqual(snapshot.public.actors, ['a', 'r', 'b']);
  assert.equal(snapshot.public.deadline, NOW + BOT_MS);
  const bet = playGameMove(snapshot.secret, 'b', { type: 'bet', amount: 50 }, rng, NOW);
  assert.deepEqual(bet.public.actors, ['a', 'r']);
  const after = playGameTimeout(bet.secret, rng, NOW + BOT_MS);
  assert.deepEqual(after.public.actors, ['a']);
  assert.equal(after.public.deadline, NOW + BOT_MS + TURN_MS);
  for (const view of [after.public.view, after.privates.a]) {
    assert.equal(JSON.stringify(view).includes('"shoe"'), false);
    assert.equal((view as { players: { stack: number }[] }).players[0].stack, 500);
  }
});
test('Président: robots complete the table to 4 and each person only sees their own hand', () => {
  const { bots, snapshot } = startGame(
    room({ game: 'president', options: { rounds: 3 } }),
    [player('a', 0), player('b', 1)],
    'a',
    newId,
    rng,
    NOW,
  );
  assert.equal(bots.length, 2);
  assert.equal(snapshot.public.seats.length, 4);
  assert.deepEqual(Object.keys(snapshot.privates).sort(), ['a', 'b']);
  type View = { players: { hand: string[] }[] };
  const mine = snapshot.privates.a as View;
  assert.ok(mine.players[0].hand.every((c) => c !== '??'));
  assert.ok(mine.players[1].hand.every((c) => c === '??'));
  assert.ok((snapshot.public.view as View).players.every((p) => p.hand.every((c) => c === '??')));
});

test('belote: robots complete the table to four and only my own hand reaches me', () => {
  const { bots, snapshot } = startGame(
    room({ game: 'belote', options: { target: 501 } }),
    [player('a', 0)],
    'a',
    newId,
    rng,
    NOW,
  );
  assert.equal(bots.length, 3);
  assert.equal(snapshot.public.seats.length, 4);
  const mine = snapshot.privates.a as { hands: string[][]; target: number };
  assert.equal(mine.target, 501);
  assert.equal(mine.hands[0].length, 5);
  assert.deepEqual(mine.hands.slice(1), [[], [], []]);
  const pub = snapshot.public.view as { hands: string[][]; stock?: unknown };
  assert.ok(pub.hands.every((h) => h.length === 0));
  assert.equal(pub.stock, undefined);
});

test('tarot: robots complete the table, the chien stays hidden, and the game reaches its end', () => {
  let a = 42;
  const seeded = (n: number) => {
    a = (a * 1103515245 + 12345) % 2147483648;
    return a % n;
  };
  assert.deepEqual(cleanOptions('tarot', {}), { deals: 4 });
  assert.throws(() => cleanOptions('tarot', { deals: 3 }), GameError);
  const { bots, snapshot } = startGame(
    room({ game: 'tarot', options: { deals: 4 } }),
    [player('a', 0)],
    'a',
    newId,
    seeded,
    NOW,
  );
  assert.equal(bots.length, 3);
  assert.equal(snapshot.public.seats.length, 4);
  let s = snapshot;
  for (let i = 0; i < 2000 && !s.public.over; i++) {
    const secret = s.secret.state as { phase: string; hands: string[][] };
    const pub = s.public.view as { hands: string[][]; chien: string[]; won?: unknown };
    assert.ok(pub.hands.every((h) => h.length === 0));
    assert.equal(pub.won, undefined);
    if (secret.phase === 'bidding') assert.deepEqual(pub.chien, []);
    const mine = s.privates.a as { hands: string[][] };
    assert.deepEqual(mine.hands[0], secret.hands[0]);
    assert.deepEqual(mine.hands.slice(1), [[], [], []]);
    s = playGameTimeout(s.secret, seeded, s.secret.deadline!);
  }
  assert.ok(s.public.over);
});

test('uno and 8 américain: a robot fills the table to two, hidden hands stay hidden, games end', () => {
  let seed = 11;
  const random = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  for (const game of ['uno', 'huit'] as const) {
    assert.throws(() => cleanOptions(game, { target: 42 }), GameError);
    const { bots, snapshot } = startGame(
      room({ game, options: cleanOptions(game, { target: 0 }) }),
      [player('a', 0)],
      'a',
      newId,
      random,
      NOW,
    );
    assert.equal(bots.length, 1);
    assert.equal(snapshot.public.seats.length, 2);
    type View = { players: { hand: string[] }[]; deck: string[]; deckCount: number };
    const mine = snapshot.privates.a as View;
    assert.equal(mine.players[0].hand.length, 7);
    assert.ok(mine.players[0].hand.every((c) => c !== '??'));
    assert.ok(mine.players[1].hand.every((c) => c === '??'));
    assert.deepEqual(mine.deck, []);
    assert.ok(mine.deckCount > 0);
    const pub = snapshot.public.view as View;
    assert.ok(pub.players.every((p) => p.hand.every((c) => c === '??')));
    // Nobody but the actors may move.
    if (!snapshot.public.actors.includes('a'))
      assert.throws(() => playGameMove(snapshot.secret, 'a', { type: 'draw' }, random, NOW), /pas ton tour/);
    let s = snapshot;
    for (let i = 0; i < 3000 && !s.public.over; i++)
      s = playGameTimeout(s.secret, random, s.secret.deadline!);
    assert.ok(s.public.over);
  }
});

test('rami: a robot joins a player alone, hands and stock stay secret, a slow player is played for', () => {
  assert.deepEqual(cleanOptions('rami', undefined), { target: 300 });
  assert.throws(() => cleanOptions('rami', { target: 1000 }), GameError);
  const { bots, snapshot } = startGame(
    room({ game: 'rami', options: { target: 150 } }),
    [player('a', 0)],
    'a',
    newId,
    rng,
    NOW,
  );
  assert.equal(bots.length, 1);
  assert.equal(snapshot.public.seats.length, 2);
  type V = { hands: string[][]; handCounts: number[]; stockCount: number; target: number; stock?: unknown };
  const mine = snapshot.privates.a as V;
  assert.equal(mine.target, 150);
  assert.equal(mine.hands[1].length, 0);
  assert.ok(mine.hands[0].length >= 13);
  assert.equal(mine.stock, undefined);
  assert.equal(mine.stockCount, 108 - 27);
  const pub = snapshot.public.view as V;
  assert.ok(pub.hands.every((h) => h.length === 0));
  assert.deepEqual(pub.handCounts, mine.handCounts);
  // Six seats at most.
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => player(id, i));
  assert.equal(startGame(room({ game: 'rami' }), six, 'a', newId, rng, NOW).snapshot.public.seats.length, 6);
  assert.throws(() => checkJoin(room({ game: 'rami' }), six, 'g', 'G'), GameError);
  // Whoever has to play and does not is played for, one step at a time.
  let s = snapshot;
  for (let i = 0; i < 6 && !s.public.over; i++) {
    assert.equal(s.public.actors.length, s.public.betweenRounds ? 0 : 1);
    s = playGameTimeout(s.secret, rng, s.secret.deadline!);
  }
});

test('experience: a little each round, more at the end, and the winners get the bonus', () => {
  // A Yams game for one person and a robot, played to the end with timeouts.
  const { snapshot } = startGame(room(), [player('a', 0), player('r', 1, true)], 'a', newId, rng, NOW);
  let s = snapshot;
  let awards: ReturnType<typeof progressAwards> = [];
  for (let i = 0; i < 2000 && !s.public.over; i++) {
    const next = playGameTimeout(s.secret, rng, s.secret.deadline!);
    awards = progressAwards(s.secret, next);
    if (!next.public.over) assert.deepEqual(awards, []);
    s = next;
  }
  assert.ok(s.public.over);
  assert.equal(awards.length, 1);
  assert.equal(awards[0].userId, 'a');
  assert.ok(awards[0].finished);
  assert.equal(awards[0].amount, awards[0].finished!.won ? 50 : 20);
});

test('tournaments: valid games only, and results once a table ends', () => {
  assert.deepEqual(cleanTournamentGames(['yams', 'morpion', 'belote']), ['yams', 'belote']);
  assert.throws(() => cleanTournamentGames([]), /1 à 8/);
  assert.equal(cleanTournamentName('  '), 'Tournoi entre amis');
  const { snapshot } = startGame(room(), [player('a', 0), player('r', 1, true)], 'a', newId, rng, NOW);
  let s = snapshot;
  let results = tournamentResults(s.secret, s);
  assert.equal(results, null);
  for (let i = 0; i < 2000 && !s.public.over; i++) {
    const next = playGameTimeout(s.secret, rng, s.secret.deadline!);
    results = tournamentResults(s.secret, next);
    s = next;
  }
  assert.equal(results?.length, 1);
  assert.equal(results![0].userId, 'a');
});

test('puissance4: a robot takes the empty seat, rounds pause, the match ends with experience', () => {
  const { bots, snapshot } = startGame(
    room({ game: 'puissance4', options: cleanOptions('puissance4', { rounds: 2 }) }),
    [player('a', 0)],
    'a',
    newId,
    rng,
    NOW,
  );
  assert.equal(bots.length, 1);
  assert.equal(bots[0].seat, 1);
  assert.deepEqual(snapshot.public.actors, ['a']);
  const full = [player('a', 0), player('b', 1)];
  assert.throws(() => checkJoin(room({ game: 'puissance4' }), full, 'c', 'C'), /pleine/);
  /** Red drops in the first free column from the center; the robot answers on its timeout. */
  const step = (s: typeof snapshot) => {
    if (s.public.actors[0] !== 'a') return playGameTimeout(s.secret, rng, s.secret.deadline!);
    const board = (s.public.view as { game: { board: unknown[][] } }).game.board;
    const col = [3, 2, 4, 1, 5, 0, 6].find((c) => board[c].includes(null))!;
    return playGameMove(s.secret, 'a', { type: 'drop', col }, rng, NOW);
  };
  let s = snapshot;
  for (let i = 0; i < 60 && !s.public.betweenRounds; i++) s = step(s);
  assert.ok(s.public.betweenRounds);
  assert.throws(() => playGameMove(s.secret, 'a', { type: 'drop', col: 1 }, rng, NOW), /pas ton tour/);
  s = playGameMove(s.secret, 'a', { type: 'next' }, rng, NOW);
  // The other player starts the second round: the robot.
  assert.deepEqual(s.public.actors, [bots[0].user_id]);
  let before = s;
  for (let i = 0; i < 60 && !s.public.over; i++) {
    before = s;
    s = step(s);
  }
  assert.ok(s.public.over);
  const awards = progressAwards(before.secret, s);
  assert.equal(awards.length, 1);
  assert.equal(awards[0].userId, 'a');
});

test('revanche: once the game is over, a new table with the asker, the robots and old seats', () => {
  const seated = [
    { ...player('a', 0), avatar: '🦊', avatar_color: '#f00' },
    { ...player('r', 1, true), avatar: '🤖', avatar_color: '#0f0' },
    { ...player('b', 2), avatar: null, avatar_color: null },
  ];
  const finished = room({ options: { x: 1 }, status: 'playing' });
  const { snapshot } = startGame(room(), seated, 'a', newId, rng, NOW);
  assert.throws(() => gameRematch(finished, snapshot.secret, seated, 'b'), /pas finie/);
  assert.throws(() => gameRematch(finished, null, seated, 'b'), /pas finie/);
  let s = snapshot;
  for (let i = 0; i < 5000 && !s.public.over; i++) s = playGameTimeout(s.secret, rng, s.secret.deadline!);
  assert.ok(s.public.over);
  assert.throws(() => gameRematch(finished, s.secret, seated, 'z'), /pas à cette table/);
  assert.throws(() => gameRematch(finished, s.secret, seated, 'r'), /pas à cette table/);
  assert.throws(() => gameRematch({ ...finished, tournament_id: 't' }, s.secret, seated, 'b'), /tournoi/);

  const plan = gameRematch(finished, s.secret, seated, 'b');
  assert.deepEqual(plan.room, { game: 'yams', host_id: 'b', options: { x: 1 } });
  assert.deepEqual(
    plan.players.map((p) => [p.user_id, p.seat, p.is_bot, p.avatar]),
    [
      ['r', 1, true, '🤖'],
      ['b', 2, false, null],
    ],
  );

  // The others follow with one tap, back in their old seat if it is still free.
  const next = room({ id: 'next', host_id: 'b' });
  const there = plan.players.map((p) => ({
    user_id: p.user_id,
    name: p.name,
    seat: p.seat,
    is_bot: p.is_bot,
  }));
  assert.deepEqual(gameRematchJoin(next, there, seated, 'a'), {
    room_id: 'next',
    user_id: 'a',
    name: 'A',
    seat: 0,
    is_bot: false,
    avatar: '🦊',
    avatar_color: '#f00',
  });
  assert.equal(gameRematchJoin(next, [...there, player('a', 0)], seated, 'a'), null);
  assert.equal(gameRematchJoin(next, [...there, player('x', 0)], seated, 'a')!.seat, 3);
  assert.throws(() => gameRematchJoin(next, there, seated, 'z'), /pas à cette table/);
  assert.throws(() => gameRematchJoin({ ...next, status: 'playing' }, there, seated, 'a'), /commencé/);
});

test('weekly ranking: one row per person once a table ends, winners first', () => {
  const { snapshot } = startGame(
    room(),
    [player('a', 0), player('b', 1), player('r', 2, true)],
    'a',
    newId,
    rng,
    NOW,
  );
  let s = snapshot;
  let rows = onlineResults('room', s.secret, s);
  assert.deepEqual(rows, []);
  for (let i = 0; i < 4000 && !s.public.over; i++) {
    const next = playGameTimeout(s.secret, rng, s.secret.deadline!);
    rows = onlineResults('room', s.secret, next);
    if (!next.public.over) assert.deepEqual(rows, []);
    s = next;
  }
  assert.ok(s.public.over);
  assert.deepEqual(rows.map((r) => r.user_id).sort(), ['a', 'b']);
  for (const r of rows) {
    assert.equal(r.room_id, 'room');
    assert.equal(r.game, 'yams');
    assert.equal(r.players, 3);
    assert.equal(r.placement === 1, r.won);
    assert.ok(r.placement >= 1 && r.placement <= 3);
  }
});
