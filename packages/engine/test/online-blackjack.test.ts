import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, Rng } from '../src/cards.ts';
import type { BjTableView } from '../src/blackjack.ts';
import { type BjOnlineState, blackjackOnline as game } from '../src/online-blackjack.ts';
import type { OnlineSeat } from '../src/online.ts';

function seeded(seed: number): Rng {
  let x = seed >>> 0 || 1;
  return (max) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % max;
  };
}
const rng = seeded(7);

const seats = (...kinds: ('h' | 'b')[]): OnlineSeat[] =>
  kinds.map((k, i) => ({ id: `u${i}`, name: `J${i}`, bot: k === 'b' }));

/** A started game whose shoe is rigged (one deck, padding so it is never reshuffled). */
function rigged(cards: Card[], s: OnlineSeat[] = seats('h', 'h')): BjOnlineState {
  const state = game.start(s, {}, rng);
  return { ...state, decks: 1, shoe: [...cards, ...Array.from({ length: 40 }, (): Card => '2c')] };
}

test('options: starting chips are checked, 1000 by default', () => {
  assert.deepEqual(game.options({}), { stack: 1000, rounds: 10 });
  assert.deepEqual(game.options({ stack: 500 }), { stack: 500, rounds: 10 });
  assert.deepEqual(game.options({ stack: 500, rounds: 20 }), { stack: 500, rounds: 20 });
  assert.throws(() => game.options({ rounds: 7 }), /manches/);
  assert.throws(() => game.options({ rounds: '5' }), /manches/);
  assert.throws(() => game.options({ stack: 123 }), /Jetons/);
  assert.throws(() => game.options({ stack: '1000' }), /Jetons/);
  const s = game.start(seats('h', 'b'), { stack: 2000 }, rng);
  assert.equal(s.startStack, 2000);
  assert.deepEqual(
    s.players.map((p) => [p.id, p.stack, p.bot]),
    [
      ['u0', 2000, false],
      ['u1', 2000, true],
    ],
  );
});

test('start: everyone bets at the same time', () => {
  const s = game.start(seats('h', 'b', 'h'), {}, rng);
  assert.equal(s.phase, 'betting');
  assert.deepEqual(game.actors(s), [0, 1, 2]);
  assert.equal(game.betweenRounds(s), false);
  assert.equal(game.over(s), false);
  const s2 = game.apply(s, 2, { type: 'bet', amount: 50 }, rng);
  assert.deepEqual(game.actors(s2), [0, 1]);
  assert.throws(() => game.apply(s2, 2, { type: 'bet', amount: 50 }, rng), /déjà misé/);
});

test('illegal and malformed moves are refused in French', () => {
  const s = rigged(['Tc', '9c', '5d', '6c', '7c', '8d']);
  for (const bad of [
    null,
    42,
    'bet',
    {},
    { type: 7 },
    { type: 'cheat' },
    { type: 'bet' },
    { type: 'bet', amount: '50' },
  ]) {
    assert.throws(() => game.apply(s, 0, bad, rng), Error);
  }
  assert.throws(() => game.apply(s, 0, { type: 'bet', amount: 5 }, rng), /Mise entre 10 et 1000/);
  assert.throws(() => game.apply(s, 0, { type: 'bet', amount: 10.5 }, rng), /Mise/);
  assert.throws(() => game.apply(s, 0, { type: 'bet', amount: 5000 }, rng), /Mise/);
  assert.throws(() => game.apply(s, 9, { type: 'bet', amount: 50 }, rng), /Place/);
  assert.throws(() => game.apply(s, 0, { type: 'hit' }, rng), /pas le moment/);

  let p = game.apply(s, 1, { type: 'bet', amount: 20 }, rng);
  p = game.apply(p, 0, { type: 'bet', amount: 30 }, rng);
  // Dealt: J0 T 6, J1 9 7, dealer 5 (hole 8). Seat 0 plays first.
  assert.equal(p.phase, 'playing');
  assert.deepEqual(game.actors(p), [0]);
  assert.throws(() => game.apply(p, 1, { type: 'stand' }, rng), /pas ton tour/);
  assert.throws(() => game.apply(p, 0, { type: 'split' }, rng), /impossible/);
  assert.throws(() => game.apply(p, 0, { type: 'bet', amount: 10 }, rng), /pas le moment/);
  p = game.apply(p, 0, { type: 'stand' }, rng);
  assert.deepEqual(game.actors(p), [1]);
});

test('view: the shoe and the hole card stay hidden, everything on the felt is shown', () => {
  // J0: Ah Kh; J1: 9c 7c; dealer up 5d, hole Qs (a card nobody else holds).
  let s = rigged(['Ah', '9c', '5d', 'Kh', '7c', 'Qs']);
  s = game.apply(s, 0, { type: 'bet', amount: 10 }, rng);
  s = game.apply(s, 1, { type: 'bet', amount: 10 }, rng);
  assert.equal(s.phase, 'playing');
  for (const seat of [0, 1, null]) {
    const v = game.view(s, seat) as BjTableView;
    const json = JSON.stringify(v);
    assert.equal('shoe' in v, false);
    assert.equal(v.shoeCount, s.shoe.length);
    assert.deepEqual(v.dealer, ['5d']);
    assert.equal(v.dealerCount, 2);
    assert.ok(!json.includes('Qs'), 'the hole card leaks');
    assert.ok(!json.includes('2c'), 'the shoe leaks');
    // Every player's cards are face up at blackjack.
    assert.deepEqual(
      v.seats.map((x) => x.hands[0].cards),
      [
        ['Ah', 'Kh'],
        ['9c', '7c'],
      ],
    );
  }
  // Once the round is over, the hole card is shown to everyone.
  s = game.apply(s, 1, { type: 'stand' }, rng);
  assert.equal(game.betweenRounds(s), true);
  const v = game.view(s, null) as BjTableView;
  assert.equal(v.dealer[1], 'Qs');
  assert.equal(v.startStack, 1000);
});

test('auto() always gives a move apply() accepts, over many rounds', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = seeded(seed);
    let s = game.start(seats('h', 'b', 'h', 'b', 'b', 'h', 'b'), { stack: 500, rounds: 20 }, r);
    let rounds = 0;
    for (let steps = 0; steps < 20000 && !game.over(s) && rounds < 40; steps++) {
      if (game.betweenRounds(s)) {
        s = game.nextRound(JSON.parse(JSON.stringify(s)), r);
        rounds++;
        continue;
      }
      const actors = game.actors(s);
      assert.ok(actors.length > 0, 'somebody must be able to move');
      // Like the server: robots first, otherwise the first person.
      const seat = actors.find((a) => s.players[a].bot) ?? actors[0];
      // The state is stored as JSON between two moves.
      s = JSON.parse(JSON.stringify(s));
      s = game.apply(s, seat, game.auto(s, seat, r), r);
    }
    assert.ok(rounds >= 10 || game.over(s), `seed ${seed}: only ${rounds} rounds`);
  }
});

test('a person who times out bets the minimum and stands', () => {
  let s = rigged(['Tc', '9c', '5d', '6c', '7c', '8d']);
  assert.deepEqual(game.auto(s, 0, rng), { type: 'bet', amount: 10 });
  s = game.apply(s, 0, game.auto(s, 0, rng), rng);
  s = game.apply(s, 1, game.auto(s, 1, rng), rng);
  assert.deepEqual(game.auto(s, 0, rng), { type: 'stand' });
});

test('the game ends when every person is out of chips, robots or not', () => {
  // J0 (person) loses everything: 10 + 6 against the dealer's 10 + 9.
  let s = rigged(['Tc', '9c', 'Td', '6c', '8c', '9d'], seats('h', 'b'));
  s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, stack: 10 } : p)) };
  s = game.apply(s, 0, { type: 'bet', amount: 10 }, rng);
  s = game.apply(s, 1, { type: 'bet', amount: 10 }, rng);
  s = game.apply(s, 0, { type: 'stand' }, rng);
  s = game.apply(s, 1, { type: 'stand' }, rng);
  assert.equal(s.phase, 'settled');
  assert.equal(s.players[0].stack, 0);
  assert.equal(game.over(s), true);
  assert.equal(game.betweenRounds(s), false);
  assert.deepEqual(game.actors(s), []);
  assert.throws(() => game.apply(s, 1, { type: 'bet', amount: 10 }, rng), /finie/);
});

test('a player without chips sits out the next rounds', () => {
  let s = rigged(['Tc', '9c', 'Td', '6c', 'Ac', '9d'], seats('h', 'h'));
  s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, stack: 10 } : p)) };
  s = game.apply(s, 0, { type: 'bet', amount: 10 }, rng);
  s = game.apply(s, 1, { type: 'bet', amount: 10 }, rng);
  s = game.apply(s, 0, { type: 'stand' }, rng);
  s = game.apply(s, 1, { type: 'stand' }, rng);
  assert.equal(s.phase, 'settled');
  assert.equal(game.over(s), false);
  s = game.nextRound(s, rng);
  assert.deepEqual(game.actors(s), [1]);
});

/** Plays one round where everyone bets the minimum and stands. */
function playRound(s: BjOnlineState): BjOnlineState {
  while (!game.betweenRounds(s) && !game.over(s)) {
    const seat = game.actors(s)[0];
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
  }
  return s;
}

test('the game ends once the rounds chosen are played; the most chips win', () => {
  let s = game.start(seats('h', 'b', 'h'), { stack: 500, rounds: 5 }, seeded(3));
  assert.equal(s.rounds, 5);
  assert.equal((game.view(s, 0) as { rounds: number }).rounds, 5);
  for (let round = 1; round < 5; round++) {
    s = playRound(s);
    assert.equal(s.round, round);
    assert.equal(game.over(s), false, `over after ${round} rounds`);
    assert.equal(game.betweenRounds(s), true);
    s = game.nextRound(s, rng);
    assert.equal(s.rounds, 5, 'the number of rounds is kept');
  }
  s = playRound(s);
  assert.equal(s.round, 5);
  assert.equal(game.over(s), true);
  assert.equal(game.betweenRounds(s), false);
  assert.deepEqual(game.actors(s), []);
  assert.throws(() => game.nextRound(s, rng), /finie/);
  assert.throws(() => game.apply(s, 0, { type: 'bet', amount: 10 }, rng), /finie/);
  const most = Math.max(...s.players.map((p) => p.stack));
  assert.deepEqual(
    game.winners(s),
    s.players.map((p, i) => (p.stack === most ? i : -1)).filter((i) => i >= 0),
  );
});

test('a table started before rounds existed keeps playing until the chips run out', () => {
  const { rounds: _, ...old } = game.start(seats('h', 'h'), {}, seeded(5));
  let s: BjOnlineState = old;
  for (let i = 0; i < 12; i++) {
    s = playRound(s);
    if (game.over(s)) break;
    s = game.nextRound(s, rng);
    assert.equal('rounds' in s, false);
  }
  assert.equal((game.view(s, 0) as { rounds: number | null }).rounds, null);
  assert.ok(s.round > 10, 'no limit on an old table');
});
