import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE_GAMES, type OnlineSeat } from '../src/online.ts';
import { PERUDO_HIDDEN, perudoOnline, perudoView } from '../src/online-perudo.ts';

function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const seats = (bots: boolean[]): OnlineSeat[] => bots.map((bot, i) => ({ id: `s${i}`, name: `S${i}`, bot }));
const game = perudoOnline;

test('registered for 2 to 6 seats, a robot joining a player alone', () => {
  assert.equal(ONLINE_GAMES.perudo, perudoOnline);
  assert.equal(game.minPlayers, 1);
  assert.equal(game.maxPlayers, 6);
  assert.equal(game.fillTo, 2);
  assert.throws(() => game.start(seats([false]), {}, seeded(1)), /de 2 à 6/);
});

test('options: Calza on by default, a boolean otherwise', () => {
  assert.deepEqual(game.options({}), { calza: true });
  assert.deepEqual(game.options(null), { calza: true });
  assert.deepEqual(game.options({ calza: false }), { calza: false });
  assert.throws(() => game.options({ calza: 'non' }), /Option/);
  assert.equal(game.start(seats([false, true]), { calza: false }, seeded(1)).calza, false);
});

test('only the player to move may move, with checked moves', () => {
  const rng = seeded(2);
  const s = game.start(seats([false, false, false]), game.options({}), rng);
  assert.deepEqual(game.actors(s), [s.current]);
  const other = (s.current + 1) % 3;
  assert.throws(() => game.apply(s, other, { type: 'bid', quantity: 1, face: 2 }, rng), /pas ton tour/);
  for (const bad of [null, 'dudo', 3, {}, { type: 'cheat' }, { type: 'bid', quantity: '2', face: 3 }])
    assert.throws(() => game.apply(s, s.current, bad, rng), Error);
  assert.throws(() => game.auto(s, other, rng), /pas son tour/);
  const next = game.apply(s, s.current, { type: 'bid', quantity: 2, face: 5, extra: 1 }, rng);
  assert.deepEqual(next.bid, { quantity: 2, face: 5 });
});

test('a view hides the others’ dice during a round, and shows them all at the reveal', () => {
  const rng = seeded(3);
  let s = game.start(seats([false, false, true, true]), game.options({}), rng);
  let reveals = 0;
  for (let step = 0; step < 400 && !game.over(s); step++) {
    for (const seat of [0, 1, 2, 3, null]) {
      const v = perudoView(s, seat);
      v.players.forEach((p, i) => {
        assert.equal(p.dice.length, s.players[i].dice.length);
        assert.equal(p.count, s.players[i].count);
        if (s.phase !== 'bidding' || i === seat) assert.deepEqual(p.dice, s.players[i].dice);
        else assert.ok(p.dice.every((d) => d === PERUDO_HIDDEN));
      });
    }
    if (game.betweenRounds(s)) {
      reveals++;
      assert.deepEqual(game.actors(s), []);
      s = game.nextRound(s, rng);
    } else {
      const [seat] = game.actors(s);
      s = game.apply(s, seat, game.auto(s, seat, rng), rng);
    }
  }
  assert.ok(reveals > 0);
});

test('auto always gives a move apply accepts, through whole games', () => {
  for (const seed of [1, 2, 3, 4]) {
    const rng = seeded(seed);
    const count = 1 + seed;
    let s = game.start(
      seats(Array.from({ length: count }, (_, i) => i > 0)),
      game.options({ calza: seed % 2 === 0 }),
      rng,
    );
    for (let guard = 0; !game.over(s); guard++) {
      assert.ok(guard < 5000, 'la partie ne finit pas');
      if (game.betweenRounds(s)) s = game.nextRound(JSON.parse(JSON.stringify(s)), rng);
      else {
        const [seat] = game.actors(s);
        s = game.apply(s, seat, game.auto(s, seat, rng), rng);
      }
    }
    assert.deepEqual(game.actors(s), []);
    const winners = game.winners(s);
    assert.equal(winners.length, 1);
    assert.ok(s.players[winners[0]].count > 0);
    assert.throws(() => game.apply(s, 0, { type: 'dudo' }, rng), /finie/);
  }
});
