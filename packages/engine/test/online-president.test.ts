import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presidentOnline as P, type PresidentOnlineState } from '../src/online-president.ts';
import { PRESIDENT_HIDDEN, type PresidentView } from '../src/president.ts';

function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `Joueur ${i}`, bot: i > 0 }));

/** Plays automatic moves until the round is over (or the game). */
function playRound(
  s: PresidentOnlineState,
  rng: (n: number) => number,
  check?: (s: PresidentOnlineState) => void,
) {
  for (let guard = 0; guard < 2000; guard++) {
    if (P.betweenRounds(s) || P.over(s)) return s;
    const actors = P.actors(s);
    assert.equal(actors.length, 1);
    const seat = actors[0];
    s = P.apply(s, seat, P.auto(s, seat, rng), rng);
    check?.(s);
  }
  throw new Error('round never ends');
}

test('options: 5 rounds by default, a number of rounds is checked', () => {
  assert.deepEqual(P.options({}), { rounds: 5 });
  assert.deepEqual(P.options({ rounds: 3 }), { rounds: 3 });
  assert.throws(() => P.options({ rounds: 0 }), /manches/);
  assert.throws(() => P.options({ rounds: 'beaucoup' }), /manches/);
  assert.throws(() => P.options({ rounds: 2.5 }), /manches/);
});

test('start deals the whole deck and the 3 of clubs leads', () => {
  const s = P.start(seats(4), { rounds: 3 }, seeded(1));
  assert.equal(s.rounds, 3);
  assert.equal(
    s.game.players.reduce((n, p) => n + p.hand.length, 0),
    52,
  );
  const [first] = P.actors(s);
  assert.ok(s.game.players[first].hand.includes('3c'));
  assert.equal(P.betweenRounds(s), false);
  assert.equal(P.over(s), false);
});

test('moves from the wrong seat or with a bad shape are refused in French', () => {
  const rng = seeded(2);
  const s = P.start(seats(4), {}, rng);
  const [me] = P.actors(s);
  const other = (me + 1) % 4;
  assert.throws(() => P.apply(s, other, { type: 'pass' }, rng), /pas ton tour/);
  for (const bad of [
    null,
    42,
    'pass',
    {},
    { type: 'cheat' },
    { type: 'play' },
    { type: 'play', cards: '3c' },
  ])
    assert.throws(() => P.apply(s, me, bad, rng), /Coup inconnu|cartes/);
  assert.throws(() => P.apply(s, me, { type: 'play', cards: [1, 2] }, rng), /cartes/);
  assert.throws(() => P.apply(s, me, { type: 'play', cards: ['3c', '3c'] }, rng), /pas permis/);
  assert.throws(() => P.apply(s, me, { type: 'play', cards: [PRESIDENT_HIDDEN] }, rng), /cartes|pas permis/);
  // Leading the first trick: no pass, and the 3 of clubs must be in.
  assert.throws(() => P.apply(s, me, { type: 'pass' }, rng), /commences/);
  assert.throws(() => P.apply(s, me, { type: 'give', cards: ['3c'] }, rng), /Rien à donner/);
  const next = P.apply(s, me, { type: 'play', cards: ['3c'] }, rng);
  assert.notEqual(P.actors(next)[0], me);
});

test('automatic moves play whole games, with exchanges, until the last round', () => {
  for (const n of [3, 4, 6, 8]) {
    const rng = seeded(10 + n);
    let s = P.start(seats(n), { rounds: 4 }, rng);
    let rounds = 0;
    let exchanges = 0;
    while (!P.over(s)) {
      s = playRound(s, rng);
      rounds++;
      if (P.betweenRounds(s)) {
        assert.deepEqual(P.actors(s), []);
        s = P.nextRound(s, rng);
        assert.equal(s.game.phase, 'exchange');
        assert.equal(
          s.game.players.reduce((k, p) => k + p.hand.length, 0),
          52,
        );
        // The winners give cards back (robots too), then play starts.
        while (s.game.phase === 'exchange') {
          const [seat] = P.actors(s);
          assert.equal(seat, s.game.pendingGives[0].from);
          s = P.apply(s, seat, P.auto(s, seat, rng), rng);
          exchanges++;
        }
        assert.equal(s.game.phase, 'playing');
      }
    }
    assert.equal(rounds, 4);
    assert.equal(P.betweenRounds(s), false);
    assert.deepEqual(P.actors(s), []);
    assert.throws(() => P.nextRound(s, rng), /finie/);
    assert.ok(exchanges > 0);
    assert.ok(s.game.players.reduce((k, p) => k + p.score, 0) > 0);
  }
});

test('a view never shows another player’s cards', () => {
  const rng = seeded(5);
  let s = P.start(seats(4), {}, rng);
  const check = (st: PresidentOnlineState) => {
    for (const seat of [0, 1, 2, 3, null]) {
      const v = P.view(st, seat) as PresidentView;
      const json = JSON.stringify(v);
      // Cards I handed over myself are still known to me.
      const known = st.game.exchanges.filter((e) => e.from === seat || e.to === seat).flatMap((e) => e.cards);
      st.game.players.forEach((p, i) => {
        if (i === seat) assert.deepEqual(v.players[i].hand, p.hand);
        else {
          assert.equal(v.players[i].hand.length, p.hand.length);
          assert.ok(v.players[i].hand.every((c) => c === PRESIDENT_HIDDEN));
          for (const c of p.hand.filter((c) => !known.includes(c)))
            assert.ok(!json.includes(`"${c}"`), `${c} of seat ${i} leaks to ${seat}`);
        }
      });
      for (const e of v.exchanges)
        if (e.from !== seat && e.to !== seat) assert.ok(e.cards.every((c) => c === PRESIDENT_HIDDEN));
    }
  };
  check(s);
  s = playRound(s, rng, check);
  s = P.nextRound(s, rng);
  check(s);
  // The exchange that just happened is known to its two players only.
  const e = s.game.exchanges[0];
  assert.deepEqual((P.view(s, e.to) as PresidentView).exchanges[0].cards, e.cards);
  playRound(s, rng, check);
});

test('the state survives a JSON round trip', () => {
  const rng = seeded(9);
  let s = P.start(seats(5), { rounds: 2 }, rng);
  for (let k = 0; k < 600 && !P.over(s); k++) {
    s = JSON.parse(JSON.stringify(s));
    if (P.betweenRounds(s)) s = P.nextRound(s, rng);
    else {
      const [seat] = P.actors(s);
      s = P.apply(s, seat, JSON.parse(JSON.stringify(P.auto(s, seat, rng))), rng);
    }
  }
  assert.ok(P.over(s));
});
