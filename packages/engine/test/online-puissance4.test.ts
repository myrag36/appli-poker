import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puissance4Online as P, type P4OnlineState } from '../src/online-puissance4.ts';
import { ONLINE_GAMES, isOnlineGame } from '../src/online.ts';

const seeded = (seed: number) => (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};

const seats = [
  { id: 'a', name: 'Alice', bot: false },
  { id: 'b', name: 'Robby', bot: true },
];

const drop = (s: P4OnlineState, seat: number, col: number) =>
  P.apply(s, seat, { type: 'drop', col }, seeded(1));

test('registered as an online game for 2 seats, a robot completing the table', () => {
  assert.ok(isOnlineGame('puissance4'));
  assert.equal(ONLINE_GAMES.puissance4, P);
  assert.equal(P.maxPlayers, 2);
  assert.equal(P.fillTo, 2);
});

test('options: 3 rounds by default, a number of rounds is checked', () => {
  assert.deepEqual(P.options({}), { rounds: 3 });
  assert.deepEqual(P.options({ rounds: 5 }), { rounds: 5 });
  assert.throws(() => P.options({ rounds: 0 }), /manches/);
  assert.throws(() => P.options({ rounds: 10 }), /manches/);
  assert.throws(() => P.options({ rounds: '3' }), /manches/);
  assert.throws(() => P.options({ rounds: 1.5 }), /manches/);
});

test('start needs exactly two seats; red (seat 0) starts', () => {
  assert.throws(() => P.start([seats[0]], {}, seeded(1)), /deux joueurs/);
  const s = P.start(seats, { rounds: 2 }, seeded(1));
  assert.equal(s.rounds, 2);
  assert.deepEqual(P.actors(s), [0]);
  assert.equal(P.over(s), false);
  assert.equal(P.betweenRounds(s), false);
});

test('moves are checked: turn, shape, column', () => {
  const s = P.start(seats, {}, seeded(1));
  assert.throws(() => drop(s, 1, 3), /ton tour/);
  assert.throws(() => P.apply(s, 0, { type: 'play', col: 3 }, seeded(1)), /Coup inconnu/);
  assert.throws(() => P.apply(s, 0, null, seeded(1)), /Coup inconnu/);
  assert.throws(() => P.apply(s, 0, { type: 'drop', col: '3' }, seeded(1)), /Coup inconnu/);
  assert.throws(() => drop(s, 0, 7), /Colonne inconnue/);
  assert.throws(() => drop(s, 0, 2.5), /Colonne inconnue/);
  let full = s;
  for (let i = 0; i < 6; i++) full = drop(full, full.game.current, 0);
  assert.throws(() => drop(full, full.game.current, 0), /pleine/);
  const next = drop(s, 0, 3);
  assert.deepEqual(P.actors(next), [1]);
  assert.equal(next.game.board[3][0], 0);
});

test('a won round waits between rounds, then the other player starts', () => {
  let s = P.start(seats, { rounds: 2 }, seeded(1));
  for (const col of [0, 6, 0, 6, 0, 6]) s = drop(s, s.game.current, col);
  s = drop(s, 0, 0);
  assert.equal(s.game.winner, 0);
  assert.deepEqual(P.actors(s), []);
  assert.equal(P.betweenRounds(s), true);
  assert.equal(P.over(s), false);
  assert.throws(() => drop(s, 0, 1), /manche est finie/);
  s = P.nextRound(s, seeded(1));
  assert.equal(s.game.round, 2);
  assert.deepEqual(s.game.scores, [1, 0]);
  assert.deepEqual(P.actors(s), [1]);
});

test('the match ends after the last round; the best score wins, a tie makes both winners', () => {
  let s = P.start(seats, { rounds: 1 }, seeded(1));
  for (const col of [0, 6, 0, 6, 0, 6, 0]) s = drop(s, s.game.current, col);
  assert.equal(P.over(s), true);
  assert.equal(P.betweenRounds(s), false);
  assert.deepEqual(P.winners(s), [0]);
  assert.throws(() => P.nextRound(s, seeded(1)), /finie/);
  const tie: P4OnlineState = { ...s, game: { ...s.game, scores: [1, 1] } };
  assert.deepEqual(P.winners(tie), [0, 1]);
});

test('robots play whole matches with legal moves', () => {
  const rng = seeded(42);
  let s = P.start(seats, P.options({ rounds: 3 }), rng);
  for (let i = 0; i < 500 && !P.over(s); i++) {
    if (P.betweenRounds(s)) s = P.nextRound(s, rng);
    else {
      const seat = P.actors(s)[0];
      s = P.apply(s, seat, P.auto(s, seat, rng), rng);
    }
  }
  assert.ok(P.over(s));
  assert.equal(s.game.round, 3);
  assert.equal(s.game.scores[0] + s.game.scores[1] + s.game.draws, 3);
  assert.deepEqual(P.view(s, null), s);
});
