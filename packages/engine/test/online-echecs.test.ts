import { test } from 'node:test';
import assert from 'node:assert/strict';
import { echecsOnline as E, type ChessOnlineState } from '../src/online-echecs.ts';
import { ONLINE_GAMES, isOnlineGame } from '../src/online.ts';

const seeded = (seed: number) => (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return Math.floor((seed / 2147483648) * n);
};

const seats = [
  { id: 'a', name: 'Alice', bot: false },
  { id: 'b', name: 'Robby', bot: true },
];

const move = (s: ChessOnlineState, seat: number, from: string, to: string) =>
  E.apply(s, seat, { type: 'move', from, to }, seeded(1));

test('registered as an online game for 2 seats, a robot completing the table', () => {
  assert.ok(isOnlineGame('echecs'));
  assert.equal(ONLINE_GAMES.echecs, E);
  assert.equal(E.maxPlayers, 2);
  assert.equal(E.fillTo, 2);
  assert.deepEqual(E.options({ anything: 1 }), {});
});

test('white (seat 0) starts; moves are checked', () => {
  assert.throws(() => E.start([seats[0]], {}, seeded(1)), /deux joueurs/);
  const s = E.start(seats, {}, seeded(1));
  assert.deepEqual(E.actors(s), [0]);
  assert.throws(() => move(s, 1, 'e7', 'e5'), /ton tour/);
  assert.throws(() => E.apply(s, 0, { type: 'drop', col: 3 }, seeded(1)), /Coup inconnu/);
  assert.throws(() => E.apply(s, 0, { type: 'move', from: 12, to: 28 }, seeded(1)), /Coup inconnu/);
  assert.throws(
    () => E.apply(s, 0, { type: 'move', from: 'e2', to: 'e4', promo: 5 }, seeded(1)),
    /Promotion/,
  );
  assert.throws(() => move(s, 0, 'e2', 'e5'), /pas permis/);
  const next = move(s, 0, 'e2', 'e4');
  assert.deepEqual(E.actors(next), [1]);
  assert.equal(E.view(next, null), next);
});

test('a checkmate ends the game with one winner; a draw gives both', () => {
  let s = E.start(seats, {}, seeded(1));
  s = move(s, 0, 'f2', 'f3');
  s = move(s, 1, 'e7', 'e5');
  s = move(s, 0, 'g2', 'g4');
  s = move(s, 1, 'd8', 'h4');
  assert.ok(E.over(s));
  assert.deepEqual(E.actors(s), []);
  assert.deepEqual(E.winners(s), [1]);
  assert.equal(E.betweenRounds(s), false);
  assert.throws(() => move(s, 0, 'a2', 'a3'), /finie/);

  let d = E.start(seats, {}, seeded(1));
  for (let i = 0; i < 2; i++) {
    d = move(d, 0, 'g1', 'f3');
    d = move(d, 1, 'g8', 'f6');
    d = move(d, 0, 'f3', 'g1');
    d = move(d, 1, 'f6', 'g8');
  }
  assert.ok(E.over(d));
  assert.deepEqual(E.winners(d), [0, 1]);
});

test('resigning on one’s turn; the robot’s move is always accepted', () => {
  const s = E.start(seats, {}, seeded(1));
  const gone = E.apply(s, 0, { type: 'resign' }, seeded(1));
  assert.deepEqual(E.winners(gone), [1]);
  assert.equal(gone.game.result?.reason, 'abandon');
  let g = s;
  for (let i = 0; i < 10; i++) {
    const seat = E.actors(g)[0];
    g = E.apply(g, seat, E.auto(g, seat, seeded(i)), seeded(i));
  }
  assert.equal(g.game.moves.length, 10);
});
