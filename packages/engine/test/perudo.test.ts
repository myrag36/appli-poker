import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type PerudoState,
  PERUDO_DICE,
  perudoApply,
  perudoAtLeast,
  perudoBidChance,
  perudoBidOptions,
  perudoBotMove,
  perudoCanCalza,
  perudoIsRaise,
  perudoMatches,
  perudoMinQuantity,
  perudoNewGame,
  perudoNextRound,
  perudoRanking,
  perudoTotalDice,
} from '../src/perudo.ts';

function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

/** A game whose dice are set by hand, player 0 to move. */
function table(dice: number[][], calza = true): PerudoState {
  const s = perudoNewGame(players(dice.length), seeded(1), { calza });
  return {
    ...s,
    current: 0,
    players: s.players.map((p, i) => ({ ...p, dice: dice[i], count: dice[i].length })),
  };
}

test('a new game: 5 sorted dice each, 2 to 6 players', () => {
  const s = perudoNewGame(players(4), seeded(2));
  assert.equal(s.players.length, 4);
  for (const p of s.players) {
    assert.equal(p.count, PERUDO_DICE);
    assert.equal(p.dice.length, PERUDO_DICE);
    assert.ok(p.dice.every((d) => d >= 1 && d <= 6));
    assert.deepEqual(
      p.dice,
      [...p.dice].sort((a, b) => a - b),
    );
  }
  assert.equal(perudoTotalDice(s), 20);
  assert.equal(s.calza, true);
  assert.equal(perudoNewGame(players(2), seeded(2), { calza: false }).calza, false);
  assert.throws(() => perudoNewGame(players(1), seeded(1)), /de 2 à 6/);
  assert.throws(() => perudoNewGame(players(7), seeded(1)), /de 2 à 6/);
});

test('Pacos are wild, except when the bid is on Pacos', () => {
  assert.equal(perudoMatches([1, 1, 3, 3, 5], 3), 4);
  assert.equal(perudoMatches([1, 1, 3, 3, 5], 1), 2);
  assert.equal(perudoMatches([2, 4, 6], 5), 0);
});

test('raising: more dice, or the same number of a higher face; Pacos halve and double + 1', () => {
  assert.equal(perudoMinQuantity(null, 1), null);
  assert.equal(perudoMinQuantity(null, 4), 1);
  const b = { quantity: 5, face: 3 };
  assert.ok(perudoIsRaise(b, { quantity: 5, face: 4 }));
  assert.ok(!perudoIsRaise(b, { quantity: 5, face: 3 }));
  assert.ok(!perudoIsRaise(b, { quantity: 5, face: 2 }));
  assert.ok(perudoIsRaise(b, { quantity: 6, face: 2 }));
  // To Pacos: half, rounded up.
  assert.ok(perudoIsRaise(b, { quantity: 3, face: 1 }));
  assert.ok(!perudoIsRaise(b, { quantity: 2, face: 1 }));
  assert.equal(perudoMinQuantity({ quantity: 6, face: 4 }, 1), 3);
  // From Pacos: double plus one.
  const p = { quantity: 3, face: 1 };
  assert.ok(perudoIsRaise(p, { quantity: 4, face: 1 }));
  assert.ok(!perudoIsRaise(p, { quantity: 6, face: 6 }));
  assert.ok(perudoIsRaise(p, { quantity: 7, face: 2 }));
});

test('bids must rise, stay within the dice in play, and not open on Pacos', () => {
  const s = table([
    [1, 2, 3, 4, 5],
    [2, 2, 6, 6, 6],
  ]);
  assert.throws(() => perudoApply(s, 1, { type: 'bid', quantity: 2, face: 3 }), /pas ton tour/);
  assert.throws(() => perudoApply(s, 0, { type: 'bid', quantity: 2, face: 1 }), /Pacos/);
  assert.throws(() => perudoApply(s, 0, { type: 'bid', quantity: 11, face: 3 }), /autant/);
  assert.throws(() => perudoApply(s, 0, { type: 'dudo' }), /enchère/);
  assert.throws(() => perudoApply(s, 0, { type: 'bid', quantity: 2.5, face: 3 }), /inconnue/);
  const a = perudoApply(s, 0, { type: 'bid', quantity: 3, face: 4 });
  assert.equal(a.current, 1);
  assert.equal(a.bidder, 0);
  assert.deepEqual(a.bid, { quantity: 3, face: 4 });
  assert.throws(() => perudoApply(a, 1, { type: 'bid', quantity: 3, face: 2 }), /monter/);
  const b = perudoApply(a, 1, { type: 'bid', quantity: 2, face: 1 });
  assert.equal(b.current, 0);
  assert.equal(b.bids.length, 2);
  // The options offered start at the smallest legal quantity for each face.
  assert.deepEqual(
    perudoBidOptions(b).map((o) => [o.face, o.min]),
    [
      [1, 3],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
      [6, 5],
    ],
  );
});

test('Dudo: the bidder loses a die when the bid was too high, the caller otherwise', () => {
  // Fours on the table: 1 four + 1 Paco + 0 = 2.
  const s = table([
    [1, 2, 3, 4, 5],
    [2, 2, 6, 6, 6],
    [3, 3, 5, 5, 6],
  ]);
  const high = perudoApply(s, 0, { type: 'bid', quantity: 3, face: 4 });
  const r1 = perudoApply(high, 1, { type: 'dudo' });
  assert.equal(r1.phase, 'reveal');
  assert.equal(r1.challenge?.actual, 2);
  assert.equal(r1.challenge?.loser, 0);
  assert.equal(r1.players[0].count, 4);
  // The dice stay visible as rolled; the loser starts the next round.
  assert.equal(r1.players[0].dice.length, 5);
  assert.equal(r1.current, 0);
  assert.throws(() => perudoApply(r1, 0, { type: 'dudo' }), /manche est finie/);
  const next = perudoNextRound(r1, seeded(3));
  assert.equal(next.players[0].dice.length, 4);
  assert.equal(next.bid, null);
  assert.equal(next.round, 2);

  const low = perudoApply(s, 0, { type: 'bid', quantity: 2, face: 4 });
  const r2 = perudoApply(low, 1, { type: 'dudo' });
  assert.equal(r2.challenge?.loser, 1);
  assert.equal(r2.players[1].count, 4);
  assert.equal(r2.current, 1);
});

test('Calza: right wins a die back (up to 5), wrong loses one, never with two players left', () => {
  const s = table([
    [1, 2, 3, 4],
    [2, 2, 6, 6, 6],
    [3, 3, 5, 5, 6],
  ]);
  const bid = perudoApply(s, 0, { type: 'bid', quantity: 4, face: 6 });
  // Sixes: 3 + 1 + 1 Paco = 5.
  assert.ok(perudoCanCalza(bid, 1));
  const wrong = perudoApply(bid, 1, { type: 'calza' });
  assert.equal(wrong.challenge?.loser, 1);
  assert.equal(wrong.players[1].count, 4);
  const exact = perudoApply(bid, 1, { type: 'bid', quantity: 5, face: 6 });
  const right = perudoApply(exact, 2, { type: 'calza' });
  assert.equal(right.challenge?.loser, null);
  assert.equal(right.challenge?.gainer, 2);
  assert.equal(right.players[2].count, 5);
  assert.equal(right.current, 2);
  // Player 0 had 4 dice: a right Calza gives one back.
  const back = perudoApply({ ...exact, current: 0 }, 0, { type: 'calza' });
  assert.equal(back.players[0].count, 5);

  const noOption = table(
    [
      [1, 2],
      [2, 2],
      [3, 3],
    ],
    false,
  );
  const b2 = perudoApply(noOption, 0, { type: 'bid', quantity: 2, face: 2 });
  assert.ok(!perudoCanCalza(b2, 1));
  assert.throws(() => perudoApply(b2, 1, { type: 'calza' }), /Calza/);
  const two = table([[2], [2]]);
  const b3 = perudoApply(two, 0, { type: 'bid', quantity: 2, face: 2 });
  assert.ok(!perudoCanCalza(b3, 1));
});

test('losing the last die knocks a player out, and the last one standing wins', () => {
  const s = table([[4], [2, 3], [5]]);
  const bid = perudoApply(s, 0, { type: 'bid', quantity: 3, face: 6 });
  const r = perudoApply(bid, 1, { type: 'dudo' });
  assert.equal(r.challenge?.eliminated, true);
  assert.deepEqual(r.out, [0]);
  // Out of the game: the next player still in starts.
  assert.equal(r.current, 1);
  const n = perudoNextRound(r, seeded(4));
  assert.equal(n.players[0].dice.length, 0);
  // Turns skip the player who is out.
  const b2 = perudoApply(n, 1, { type: 'bid', quantity: 1, face: 2 });
  assert.equal(b2.current, 2);
  const end = perudoApply(
    { ...b2, players: b2.players.map((p, i) => (i === 1 ? { ...p, dice: [3], count: 1 } : p)) },
    2,
    { type: 'dudo' },
  );
  assert.ok(end.phase === 'over' || end.phase === 'reveal');
  const finished = perudoApply(
    {
      ...n,
      players: n.players.map((p, i) =>
        i === 1 ? { ...p, dice: [3], count: 1 } : i === 2 ? { ...p, dice: [5], count: 1 } : p,
      ),
      current: 1,
    },
    1,
    { type: 'bid', quantity: 2, face: 6 },
  );
  const last = perudoApply(finished, 2, { type: 'dudo' });
  assert.equal(last.phase, 'over');
  assert.equal(last.winner, 2);
  assert.deepEqual(perudoRanking(last), [2, 1, 0]);
  assert.throws(() => perudoApply(last, 2, { type: 'dudo' }), /finie/);
});

test('probabilities: a bid on what I hold is safe, a huge one is not', () => {
  assert.equal(perudoAtLeast(10, 0, 1 / 3), 1);
  assert.ok(Math.abs(perudoAtLeast(1, 1, 1 / 3) - 1 / 3) < 1e-9);
  const s = table([
    [1, 1, 5, 5, 5],
    [2, 3, 4, 6, 6],
  ]);
  assert.equal(perudoBidChance(s, 0, { quantity: 5, face: 5 }), 1);
  assert.ok(perudoBidChance(s, 0, { quantity: 10, face: 2 }) < 0.01);
});

test('robots doubt an impossible bid and raise a sure one', () => {
  const s = table([
    [1, 1, 5, 5, 5],
    [2, 3, 4, 6, 6],
  ]);
  const crazy = perudoApply({ ...s, current: 1 }, 1, { type: 'bid', quantity: 9, face: 2 });
  for (let seed = 0; seed < 20; seed++)
    assert.deepEqual(perudoBotMove(crazy, 0, seeded(seed)), { type: 'dudo' });
  const small = perudoApply({ ...s, current: 1 }, 1, { type: 'bid', quantity: 1, face: 2 });
  for (let seed = 0; seed < 20; seed++) assert.equal(perudoBotMove(small, 0, seeded(seed)).type, 'bid');
});

test('robots play whole games to the end with legal moves', () => {
  for (const n of [2, 3, 4, 6])
    for (const seed of [1, 2, 3]) {
      const rng = seeded(seed * 10 + n);
      let s = perudoNewGame(players(n), rng, { calza: seed !== 2 });
      let guard = 0;
      while (s.phase !== 'over') {
        assert.ok(guard++ < 5000, 'la partie ne finit pas');
        if (s.phase === 'reveal') s = perudoNextRound(s, rng);
        else s = perudoApply(s, s.current, perudoBotMove(s, s.current, rng));
        const total = perudoTotalDice(s);
        assert.ok(total >= 1 && total <= n * PERUDO_DICE);
      }
      assert.notEqual(s.winner, null);
      assert.equal(s.out.length, n - 1);
      assert.equal(perudoRanking(s)[0], s.winner);
    }
});
