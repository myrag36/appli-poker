import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type BeloteState, type BeloteView, beloteLegalMoves } from '../src/belote.ts';
import { beloteOnline as game } from '../src/online-belote.ts';
import type { OnlineSeat } from '../src/online.ts';

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

const seats: OnlineSeat[] = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id.toUpperCase(), bot: i > 0 }));

/** Plays with auto() for whoever has to act until the deal is over. */
function playDeal(state: BeloteState, rng: ReturnType<typeof seeded>): BeloteState {
  let s = state;
  for (let guard = 0; game.actors(s).length > 0; guard++) {
    assert.ok(guard < 200, 'la donne ne finit pas');
    const [seat] = game.actors(s);
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
  }
  return s;
}

test('options: 1000 by default, 501 or 1000 only', () => {
  assert.deepEqual(game.options({}), { target: 1000 });
  assert.deepEqual(game.options({ target: 501 }), { target: 501 });
  assert.throws(() => game.options({ target: 42 }), /501 ou 1000/);
  assert.throws(() => game.options({ target: '501' }), /501 ou 1000/);
});

test('robots complete the table up to four seats', () => {
  assert.equal(game.minPlayers, 1);
  assert.equal(game.maxPlayers, 4);
  assert.equal(game.fillTo, 4);
  assert.throws(() => game.start(seats.slice(0, 3), {}, seeded(1)), /à 4/);
});

test('start deals five cards each and waits for the player on the dealer’s left', () => {
  const s = game.start(seats, { target: 501 }, seeded(1));
  assert.equal(s.target, 501);
  assert.equal(s.phase, 'bidding1');
  assert.ok(s.hands.every((h) => h.length === 5));
  assert.deepEqual(game.actors(s), [(s.dealer + 1) % 4]);
  assert.equal(game.betweenRounds(s), false);
  assert.equal(game.over(s), false);
});

test('moves from the wrong seat or with a bad shape are refused', () => {
  const rng = seeded(2);
  const s = game.start(seats, {}, rng);
  const [seat] = game.actors(s);
  const other = (seat + 1) % 4;
  assert.throws(() => game.apply(s, other, { type: 'pass' }, rng), /pas ton tour/);
  for (const bad of [null, 'pass', 42, {}, { type: 'cheat' }, { type: 'choose' }, { type: 'play', card: 7 }])
    assert.throws(() => game.apply(s, seat, bad, rng), Error);
  assert.throws(() => game.apply(s, seat, { type: 'choose', suit: 'h' }, rng), /impossible/);
  assert.throws(() => game.apply(s, seat, { type: 'play', card: s.hands[seat][0] }, rng), /enchères/);
  assert.throws(() => game.auto(s, other, rng), /pas son tour/);

  const taken = game.apply(s, seat, { type: 'take', extra: 'ignored' }, rng);
  assert.equal(taken.phase, 'playing');
  const [player] = game.actors(taken);
  assert.throws(() => game.apply(taken, player, { type: 'play', card: 'Xx' }, rng), /pas cette carte/);
  const legal = beloteLegalMoves(taken).map((m) => (m as { card: string }).card);
  const notMine = taken.hands[(player + 1) % 4][0];
  assert.throws(() => game.apply(taken, player, { type: 'play', card: notMine }, rng), /pas cette carte/);
  const next = game.apply(taken, player, { type: 'play', card: legal[0] }, rng);
  assert.equal(next.trick.length, 1);
  // Following suit is compulsory: a card that does not follow is refused.
  const [second] = game.actors(next);
  const led = legal[0][1];
  const illegal = next.hands[second].find(
    (c) => !beloteLegalMoves(next).some((m) => (m as { card: string }).card === c),
  );
  if (illegal && next.hands[second].some((c) => c[1] === led))
    assert.throws(() => game.apply(next, second, { type: 'play', card: illegal }, rng), /pas permise/);
});

test('second round: a suit other than the turned-up one, or pass', () => {
  const rng = seeded(3);
  let s = game.start(seats, {}, rng);
  for (let i = 0; i < 4; i++) s = game.apply(s, game.actors(s)[0], { type: 'pass' }, rng);
  assert.equal(s.phase, 'bidding2');
  const [seat] = game.actors(s);
  assert.throws(() => game.apply(s, seat, { type: 'take' }, rng), /impossible/);
  assert.throws(() => game.apply(s, seat, { type: 'choose', suit: s.turnUp![1] }, rng), /impossible/);
  assert.throws(() => game.apply(s, seat, { type: 'choose', suit: 'x' }, rng), /Couleur/);
  for (let i = 0; i < 4; i++) s = game.apply(s, game.actors(s)[0], { type: 'pass' }, rng);
  // Nobody took: the deal is over and the next one can start.
  assert.equal(game.betweenRounds(s), true);
  assert.deepEqual(game.actors(s), []);
  const next = game.nextRound(s, rng);
  assert.equal(next.phase, 'bidding1');
  assert.equal(next.dealer, (s.dealer + 1) % 4);
});

test('auto always gives a move apply accepts, through whole games', () => {
  for (const seed of [1, 2, 3, 4]) {
    const rng = seeded(seed);
    let s = game.start(seats, { target: 501 }, rng);
    let deals = 0;
    while (!game.over(s)) {
      s = playDeal(s, rng);
      deals++;
      assert.ok(deals < 60, 'la partie ne finit pas');
      if (game.betweenRounds(s)) s = game.nextRound(s, rng);
    }
    assert.equal(game.betweenRounds(s), false);
    assert.deepEqual(game.actors(s), []);
    assert.ok(Math.max(...s.scores) >= 501);
    assert.throws(() => game.apply(s, 0, { type: 'pass' }, rng), /Personne/);
  }
});

test('a view shows my hand only, never the others’ cards nor the stock', () => {
  const rng = seeded(5);
  let s = game.start(seats, {}, rng);
  const check = (state: BeloteState) => {
    for (const seat of [0, 1, 2, 3, null]) {
      const v = game.view(state, seat) as BeloteView;
      const json = JSON.stringify(v);
      assert.ok(!('stock' in v));
      assert.equal(v.stockCount, state.stock.length);
      assert.deepEqual(
        v.handCounts,
        state.hands.map((h) => h.length),
      );
      state.hands.forEach((hand, i) => {
        if (i === seat) assert.deepEqual(v.hands[i], hand);
        else assert.deepEqual(v.hands[i], []);
      });
      // No hidden card appears anywhere: other hands and the stock are gone.
      const visible = new Set([
        ...(seat === null ? [] : state.hands[seat]),
        ...state.trick.map((p) => p.card),
        ...(state.lastTrick?.cards.map((p) => p.card) ?? []),
        ...(state.turnUp ? [state.turnUp] : []),
      ]);
      const hidden = [...state.hands.flat(), ...state.stock].filter((c) => !visible.has(c));
      for (const c of hidden) assert.ok(!json.includes(`"${c}"`), `${c} visible par ${seat}`);
      // Who holds belote is secret until it is announced.
      if (state.belotePlayed === 0 && state.beloteHolder !== seat) assert.equal(v.beloteHolder, null);
    }
  };
  check(s);
  s = game.apply(s, game.actors(s)[0], { type: 'take' }, rng);
  check(s);
  for (let i = 0; i < 6; i++) {
    const [seat] = game.actors(s);
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
    check(s);
  }
});

test('the state survives a JSON round trip', () => {
  const rng = seeded(6);
  let s = game.start(seats, {}, rng);
  for (let i = 0; i < 40 && !game.over(s); i++) {
    s = JSON.parse(JSON.stringify(s));
    if (game.betweenRounds(s)) {
      s = game.nextRound(s, rng);
      continue;
    }
    const [seat] = game.actors(s);
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
