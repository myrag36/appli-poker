import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type BnLevel,
  type BnShip,
  type BnState,
  BN_FLEET,
  BN_SIZE,
  bnAfloat,
  bnBotShot,
  bnCanPlace,
  bnCheckFleet,
  bnNewGame,
  bnPlace,
  bnPublicBoard,
  bnRandomFleet,
  bnShipCells,
  bnShoot,
} from '../src/bataille.ts';

function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

/** One ship per row, from the left: 5 on row 0, 4 on row 2, 3 on rows 4 and 6, 2 on row 8. */
const ROWS: BnShip[] = BN_FLEET.map((size, i) => ({ x: 0, y: i * 2, size, horizontal: true }));

const placed = (a: BnShip[] = ROWS, b: BnShip[] = ROWS): BnState =>
  bnPlace(bnPlace(bnNewGame(0), 0, a), 1, b);

test('ship cells, fitting and overlaps', () => {
  assert.deepEqual(bnShipCells({ x: 2, y: 3, size: 3, horizontal: false }), [
    [2, 3],
    [2, 4],
    [2, 5],
  ]);
  assert.equal(bnCanPlace([], { x: 6, y: 0, size: 5, horizontal: true }), false);
  assert.equal(bnCanPlace([], { x: 5, y: 0, size: 5, horizontal: true }), true);
  assert.equal(bnCanPlace(ROWS, { x: 4, y: 0, size: 2, horizontal: false }), false);
  // Touching is allowed, overlapping is not.
  assert.equal(bnCanPlace(ROWS, { x: 5, y: 0, size: 2, horizontal: true }), true);
});

test('a fleet is checked: five ships of the right sizes, on the grid, without overlaps', () => {
  assert.deepEqual(bnCheckFleet(ROWS), ROWS);
  assert.throws(() => bnCheckFleet(ROWS.slice(1)), /Flotte invalide/);
  assert.throws(() => bnCheckFleet('x'), /Flotte invalide/);
  assert.throws(() => bnCheckFleet([...ROWS.slice(0, 4), { ...ROWS[4], size: 3 }]), /Flotte invalide/);
  assert.throws(
    () => bnCheckFleet([...ROWS.slice(0, 4), { x: 9, y: 9, size: 2, horizontal: true }]),
    /grille/,
  );
  assert.throws(
    () => bnCheckFleet([...ROWS.slice(0, 4), { x: 0, y: 6, size: 2, horizontal: false }]),
    /chevaucher/,
  );
  assert.throws(
    () => bnCheckFleet([...ROWS.slice(0, 4), { x: 0.5, y: 9, size: 2, horizontal: true }]),
    /grille/,
  );
  assert.throws(() => bnCheckFleet([...ROWS.slice(0, 4), { x: 0, y: 9, size: 2 }]), /Flotte invalide/);
});

test('a fleet with a huge ship size is refused at once, without listing its cells', () => {
  // 2^32 used to crash with a RangeError, and 1e8 kept the server busy for about a minute.
  for (const size of [2 ** 32, 1e8, 0, -1, Number.NaN]) {
    const t = Date.now();
    assert.throws(() => bnCheckFleet(ROWS.map((s) => ({ ...s, size }))), /Flotte invalide/);
    assert.ok(Date.now() - t < 100, `taille ${size} : trop long`);
  }
});

test('random fleets are always valid and never touch', () => {
  const rng = seeded(3);
  for (let i = 0; i < 200; i++) {
    const fleet = bnRandomFleet(rng);
    bnCheckFleet(fleet);
    const owner = new Map<number, number>();
    fleet.forEach((s, k) => bnShipCells(s).forEach(([x, y]) => owner.set(y * BN_SIZE + x, k)));
    for (const [cell, k] of owner) {
      const x = cell % BN_SIZE;
      const y = Math.floor(cell / BN_SIZE);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const o = owner.get((y + dy) * BN_SIZE + x + dx);
          if (x + dx >= 0 && x + dx < BN_SIZE && o !== undefined) assert.equal(o, k);
        }
    }
  }
});

test('placement: each player once, then shooting starts', () => {
  let s = bnNewGame(0);
  assert.throws(() => bnShoot(s, 0, 0), /pas encore placées/);
  s = bnPlace(s, 1, ROWS);
  assert.equal(s.phase, 'placement');
  assert.throws(() => bnPlace(s, 1, ROWS), /déjà placée/);
  s = bnPlace(s, 0, ROWS);
  assert.equal(s.phase, 'tir');
  assert.throws(() => bnPlace(s, 0, ROWS), /déjà placées/);
});

test('shots: miss, hit, sunk, turns alternate, no shot twice on a cell', () => {
  let s = placed();
  s = bnShoot(s, 9, 9);
  assert.deepEqual(s.lastShot, { x: 9, y: 9, hit: false, by: 0 });
  assert.equal(s.current, 1);
  s = bnShoot(s, 0, 8);
  assert.equal(s.lastShot?.hit, true);
  assert.equal(s.lastShot?.sunk, undefined);
  s = bnShoot(s, 0, 1);
  assert.throws(() => bnShoot(s, 0, 8), /déjà tiré/);
  assert.throws(() => bnShoot(s, 10, 0), /Case inconnue/);
  s = bnShoot(s, 1, 8);
  assert.equal(s.lastShot?.sunk, 2);
  assert.deepEqual(bnAfloat(s.boards[0]!), [5, 4, 3, 3]);
  assert.deepEqual(s.fired, [2, 2]);
});

test('sinking the whole fleet wins', () => {
  let s = placed();
  const targets = ROWS.flatMap(bnShipCells);
  const misses = Array.from({ length: BN_SIZE }, (_, x) => [x, 9] as [number, number]).concat(
    Array.from({ length: BN_SIZE }, (_, x) => [x, 7] as [number, number]),
  );
  for (const [x, y] of targets) {
    s = bnShoot(s, x, y);
    if (s.phase === 'fini') break;
    const [mx, my] = misses.shift()!;
    s = bnShoot(s, mx, my);
  }
  assert.equal(s.phase, 'fini');
  assert.equal(s.winner, 0);
  assert.throws(() => bnShoot(s, 5, 5), /finie/);
});

test('the public grid shows the shots and only the sunk ships', () => {
  let s = placed();
  s = bnShoot(s, 0, 8);
  s = bnShoot(s, 5, 5);
  s = bnShoot(s, 1, 8);
  const pub = bnPublicBoard(s.boards[1]!);
  assert.deepEqual(pub.ships, [ROWS[4]]);
  assert.equal(pub.shots.length, 2);
});

/** Plays a robot against a fixed fleet; returns the number of shots needed to sink it. */
function shotsToSink(level: BnLevel, seed: number, fleet: BnShip[]): number {
  const rng = seeded(seed);
  let s = placed(fleet, fleet);
  for (let n = 1; n <= 100; n++) {
    const { x, y } = bnBotShot(s.boards[1]!, level, rng);
    s = bnShoot(s, x, y);
    if (s.phase === 'fini') return n;
    // Only the robot fires here: give it the turn back.
    s = { ...s, current: 0 };
  }
  return 100;
}

test('robots never shoot the same cell twice and better levels sink faster', () => {
  const avg = (level: BnLevel) => {
    let total = 0;
    for (let seed = 1; seed <= 25; seed++) total += shotsToSink(level, seed, bnRandomFleet(seeded(seed * 7)));
    return total / 25;
  };
  const facile = avg('facile');
  const moyen = avg('moyen');
  const difficile = avg('difficile');
  assert.ok(facile <= 100 && moyen < facile && difficile < moyen, `${facile} ${moyen} ${difficile}`);
  assert.ok(difficile < 60, `difficile: ${difficile}`);
});

test('after a hit, the robot follows the line', () => {
  let s = placed();
  // Player 0 hits (3,0) and (4,0) of the 5-ship on row 0; the next shot must extend the line.
  s = bnShoot(s, 3, 0);
  s = bnShoot(s, 9, 9);
  s = bnShoot(s, 4, 0);
  s = bnShoot(s, 9, 8);
  for (const level of ['moyen', 'difficile'] as BnLevel[])
    for (let seed = 0; seed < 10; seed++) {
      const shot = bnBotShot(s.boards[1]!, level, seeded(seed));
      assert.ok(shot.y === 0 && (shot.x === 2 || shot.x === 5), `${level}: ${JSON.stringify(shot)}`);
    }
});
