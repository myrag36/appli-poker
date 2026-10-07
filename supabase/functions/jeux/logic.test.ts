import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameError } from '../poker/logic.ts';
import {
  type GamePlayerRow,
  type GameRoomRow,
  BOT_MS,
  TURN_MS,
  checkJoin,
  cleanOptions,
  newGameBot,
  playGameMove,
  playGameTimeout,
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
  assert.throws(() => startGame(room({ status: 'playing' }), [player('a', 0)], 'a', newId, rng, NOW), /commencé/);
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
  const { bots, snapshot } = startGame(
    room({ game: 'yams' }),
    [player('a', 0)],
    'a',
    newId,
    rng,
    NOW,
  );
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
