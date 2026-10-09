import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batailleOnline as B, type BnOnlineState, type BnOnlineView } from '../src/online-bataille.ts';
import { ONLINE_GAMES, isOnlineGame } from '../src/online.ts';
import { BN_FLEET, type BnShip, bnRandomFleet, bnShipCells } from '../src/bataille.ts';

const seeded = (seed: number) => (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};

const seats = [
  { id: 'a', name: 'Alice', bot: false },
  { id: 'b', name: 'Bob', bot: false },
];

const ROWS: BnShip[] = BN_FLEET.map((size, i) => ({ x: 0, y: i * 2, size, horizontal: true }));
const COLS: BnShip[] = BN_FLEET.map((size, i) => ({ x: i * 2, y: 0, size, horizontal: false }));

const place = (s: BnOnlineState, seat: number, ships: BnShip[]) =>
  B.apply(s, seat, { type: 'place', ships }, seeded(1));
const shoot = (s: BnOnlineState, seat: number, x: number, y: number) =>
  B.apply(s, seat, { type: 'shoot', x, y }, seeded(1));

/** Every ship cell sent to a viewer, as "x,y", for a grid. */
const shipCells = (v: BnOnlineView, p: number) =>
  new Set((v.game.boards[p]?.ships ?? []).flatMap(bnShipCells).map(([x, y]) => `${x},${y}`));

test('registered as an online game for 2 seats, a robot completing the table', () => {
  assert.ok(isOnlineGame('bataille'));
  assert.equal(ONLINE_GAMES.bataille, B);
  assert.equal(B.maxPlayers, 2);
  assert.equal(B.fillTo, 2);
  assert.deepEqual(B.options({ anything: 1 }), {});
  assert.throws(() => B.start([seats[0]], {}, seeded(1)), /deux joueurs/);
});

test('both players place at the same time, then seat 0 fires first', () => {
  let s = B.start(seats, {}, seeded(1));
  assert.deepEqual(B.actors(s), [0, 1]);
  assert.throws(() => shoot(s, 0, 0, 0), /pas encore placées/);
  assert.throws(() => place(s, 0, ROWS.slice(1)), /Flotte invalide/);
  s = place(s, 1, COLS);
  assert.deepEqual(B.actors(s), [0]);
  assert.throws(() => place(s, 1, COLS), /déjà placée/);
  s = place(s, 0, ROWS);
  assert.deepEqual(B.actors(s), [0]);
  assert.throws(() => shoot(s, 1, 0, 0), /ton tour/);
  assert.throws(() => B.apply(s, 0, { type: 'shoot', x: '1', y: 0 }, seeded(1)), /Coup inconnu/);
  assert.throws(() => B.apply(s, 0, null, seeded(1)), /Coup inconnu/);
  s = shoot(s, 0, 0, 0);
  assert.equal(s.game.lastShot?.hit, true);
  assert.deepEqual(B.actors(s), [1]);
  assert.equal(B.betweenRounds(s), false);
});

test('views never reveal the ships of the other fleet that are not sunk', () => {
  let s = B.start(seats, {}, seeded(1));
  s = place(s, 0, ROWS);
  // Seat 1 only learns that the fleet of seat 0 is ready; its own grid is not placed yet.
  let v0 = B.view(s, 1) as BnOnlineView;
  assert.deepEqual(v0.game.boards[0], { ships: [], shots: [] });
  assert.equal(v0.game.boards[1], null);
  assert.deepEqual(v0.placed, [true, false]);
  s = place(s, 1, COLS);
  v0 = B.view(s, 0) as BnOnlineView;
  const v1 = B.view(s, 1) as BnOnlineView;
  const spectator = B.view(s, null) as BnOnlineView;
  assert.equal(v0.game.boards[0]!.ships.length, 5);
  assert.equal(v0.game.boards[1]!.ships.length, 0);
  assert.equal(v1.game.boards[0]!.ships.length, 0);
  assert.equal(v1.game.boards[1]!.ships.length, 5);
  assert.equal(spectator.game.boards[0]!.ships.length, 0);
  assert.equal(spectator.game.boards[1]!.ships.length, 0);
  // The serialized view of seat 0 holds nothing about seat 1's ships.
  assert.ok(!JSON.stringify(v0).includes('"horizontal":false'));

  // Sink the 2-ship of seat 1 (column 8, rows 0-1): only that one shows up for seat 0.
  s = shoot(s, 0, 8, 0);
  s = shoot(s, 1, 9, 9);
  s = shoot(s, 0, 8, 1);
  const after = B.view(s, 0) as BnOnlineView;
  assert.deepEqual(after.game.boards[1]!.ships, [COLS[4]]);
  assert.deepEqual([...shipCells(after, 1)].sort(), ['8,0', '8,1']);
  assert.equal(after.game.boards[1]!.shots.length, 2);
});

test('robots play whole games with legal moves; everything is shown at the end', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const rng = seeded(seed);
    const bots = seats.map((x) => ({ ...x, bot: true }));
    let s = B.start(bots, B.options({}), rng);
    for (let i = 0; i < 300 && !B.over(s); i++) {
      const seat = B.actors(s)[0];
      s = B.apply(s, seat, B.auto(s, seat, rng), rng);
    }
    assert.ok(B.over(s));
    assert.deepEqual(B.actors(s), []);
    const winners = B.winners(s);
    assert.equal(winners.length, 1);
    assert.equal(s.game.winner, winners[0]);
    const v = B.view(s, null) as BnOnlineView;
    assert.equal(v.game.boards[0]!.ships.length, 5);
    assert.equal(v.game.boards[1]!.ships.length, 5);
    assert.throws(() => B.nextRound(s, rng), /finie/);
    assert.throws(() => B.apply(s, 0, B.auto(s, 0, rng), rng), /finie/);
  }
});

test('a random fleet sent by a player is accepted', () => {
  let s = B.start(seats, {}, seeded(2));
  s = place(s, 0, bnRandomFleet(seeded(3)));
  s = place(s, 1, bnRandomFleet(seeded(4)));
  assert.equal(s.game.phase, 'tir');
});
