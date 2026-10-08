import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type RamiState, type RamiView, ramiApply } from '../src/rami.ts';
import { ramiOnline as game } from '../src/online-rami.ts';
import { ONLINE_GAMES, type OnlineSeat } from '../src/online.ts';

/** Seeded generator so the tests always see the same games. */
function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const seatsOf = (n: number): OnlineSeat[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: i > 0 }));

function playRound(state: RamiState, rng: ReturnType<typeof seeded>): RamiState {
  let s = state;
  for (let guard = 0; game.actors(s).length > 0; guard++) {
    assert.ok(guard < 2000, 'la manche ne finit pas');
    const [seat] = game.actors(s);
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
  }
  return s;
}

test('registered as an online game, 2 to 6 seats with a robot for a player alone', () => {
  assert.equal(ONLINE_GAMES.rami, game);
  assert.equal(game.minPlayers, 1);
  assert.equal(game.maxPlayers, 6);
  assert.equal(game.fillTo, 2);
});

test('options: 300 by default, 150, 300 or 500 only', () => {
  assert.deepEqual(game.options({}), { target: 300 });
  assert.deepEqual(game.options(null), { target: 300 });
  assert.deepEqual(game.options({ target: 150 }), { target: 150 });
  assert.throws(() => game.options({ target: 42 }), /150, 300 ou 500/);
  assert.throws(() => game.options({ target: '500' }), /150, 300 ou 500/);
});

test('start deals 13 cards each, 14 to the first player, for 2 to 6 seats', () => {
  for (let n = 2; n <= 6; n++) {
    const s = game.start(seatsOf(n), { target: 150 }, seeded(n));
    assert.equal(s.target, 150);
    assert.equal(s.players.length, n);
    assert.deepEqual(
      s.players.map((p) => p.bot),
      seatsOf(n).map((p) => p.bot),
    );
    assert.equal(s.hands.flat().length, 13 * n + 1);
    assert.equal(s.stock.length, 108 - 13 * n - 1);
    assert.deepEqual(game.actors(s), [s.current]);
    assert.equal(s.hands[s.current].length, 14);
  }
  assert.throws(() => game.start(seatsOf(7), {}, seeded(1)), /2 à 6/);
});

test('moves from the wrong seat or with a bad shape are refused', () => {
  const rng = seeded(7);
  const s = game.start(seatsOf(3), {}, rng);
  const seat = s.current;
  const other = (seat + 1) % 3;
  assert.throws(
    () => game.apply(s, other, { type: 'discard', card: s.hands[other][0] }, rng),
    /pas ton tour/,
  );
  assert.throws(() => game.auto(s, other, rng), /pas son tour/);
  for (const bad of [
    null,
    'draw',
    42,
    {},
    { type: 'cheat' },
    { type: 'discard' },
    { type: 'discard', card: 7 },
    { type: 'meld' },
    { type: 'meld', melds: [] },
    { type: 'meld', melds: ['Ah1Ah2Ac1'] },
    { type: 'meld', melds: [[1, 2, 3]] },
    { type: 'add', meld: '1', cards: ['Ah1'] },
    { type: 'add', meld: 1, cards: 'Ah1' },
    { type: 'swap', meld: 1.5, card: 'Ah1' },
  ])
    assert.throws(() => game.apply(s, seat, bad, rng), Error);
  // The first player holds 14 cards and starts by playing, not drawing.
  assert.throws(() => game.apply(s, seat, { type: 'draw' }, rng), /déjà pioché/);
  const notMine = s.hands[other][0];
  if (!s.hands[seat].includes(notMine))
    assert.throws(() => game.apply(s, seat, { type: 'discard', card: notMine }, rng), /pas cette carte/);
  const next = game.apply(s, seat, { type: 'discard', card: s.hands[seat][0], extra: 1 }, rng);
  assert.deepEqual(game.actors(next), [other]);
  assert.equal(next.phase, 'draw');
});

test('a view shows my hand only, never the others’ cards nor the stock', () => {
  const rng = seeded(11);
  let s = game.start(seatsOf(4), {}, rng);
  const check = (state: RamiState) => {
    for (const seat of [0, 1, 2, 3, null]) {
      const v = game.view(state, seat) as RamiView;
      assert.ok(!('stock' in v));
      assert.equal(v.stockCount, state.stock.length);
      assert.deepEqual(
        v.handCounts,
        state.hands.map((h) => h.length),
      );
      state.hands.forEach((hand, i) => assert.deepEqual(v.hands[i], i === seat ? hand : []));
      if (state.phase === 'draw' || state.phase === 'play') {
        const json = JSON.stringify(v);
        const visible = new Set([
          ...(seat === null ? [] : state.hands[seat]),
          ...state.discard,
          ...state.melds.flatMap((m) => m.cards),
          ...(state.last?.cards ?? []),
        ]);
        const hidden = [...state.hands.flat(), ...state.stock].filter((c) => !visible.has(c));
        assert.ok(hidden.length > 0);
        for (const c of hidden) assert.ok(!json.includes(`"${c}"`), `${c} visible par ${seat}`);
      }
    }
  };
  for (let step = 0; step < 120 && game.actors(s).length > 0; step++) {
    check(s);
    const [seat] = game.actors(s);
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
  }
  check(s);
});

test('the card drawn from the stock stays hidden from the others', () => {
  const rng = seeded(12);
  let s = game.start(seatsOf(2), {}, rng);
  s = game.apply(s, s.current, { type: 'discard', card: s.hands[s.current][0] }, rng);
  const drawer = s.current;
  const top = s.stock[0];
  s = game.apply(s, drawer, { type: 'draw' }, rng);
  assert.ok(s.hands[drawer].includes(top));
  const other = JSON.stringify(game.view(s, 1 - drawer));
  if (!s.hands[1 - drawer].includes(top)) assert.ok(!other.includes(`"${top}"`));
  assert.ok(JSON.stringify(game.view(s, drawer)).includes(`"${top}"`));
});

test('auto always gives a move apply accepts, through whole games of 2 to 6', () => {
  for (const n of [2, 3, 6]) {
    const rng = seeded(100 + n);
    let s = game.start(seatsOf(n), { target: 150 }, rng);
    let rounds = 0;
    while (!game.over(s)) {
      s = playRound(s, rng);
      rounds++;
      assert.ok(rounds < 40, 'la partie ne finit pas');
      if (game.betweenRounds(s)) {
        assert.deepEqual(game.actors(s), []);
        s = game.nextRound(s, rng);
        assert.equal(s.round, rounds + 1);
      }
    }
    assert.equal(game.betweenRounds(s), false);
    assert.deepEqual(game.actors(s), []);
    assert.ok(Math.max(...s.scores) >= 150);
    const best = Math.min(...s.scores);
    const winners = game.winners(s);
    assert.ok(winners.length >= 1);
    for (const w of winners) assert.equal(s.scores[w], best);
    assert.throws(() => game.apply(s, 0, { type: 'draw' }, rng), /Personne/);
  }
});

test('apply follows the engine exactly', () => {
  const rng = seeded(21);
  const s = game.start(seatsOf(2), {}, rng);
  const move = game.auto(s, s.current, rng);
  assert.deepEqual(game.apply(s, s.current, move, seeded(1)), ramiApply(s, move as never, seeded(1)));
});
