import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE_GAMES, type OnlineGameId } from '../src/index.ts';

const seeded = (seed: number) => (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};

// Plays a whole game with robots on every seat, then checks who won.
for (const [game, count, options] of [
  ['yams', 2, {}],
  ['belote', 4, { target: 501 }],
  ['president', 4, { rounds: 2 }],
  ['uno', 3, { target: 200 }],
  ['huit', 2, { target: 100 }],
  ['perudo', 4, {}],
] as [OnlineGameId, number, Record<string, unknown>][]) {
  test(`${game}: the winners are known once the game is over`, () => {
    const def = ONLINE_GAMES[game];
    const rng = seeded(7);
    const seats = Array.from({ length: count }, (_, i) => ({ id: `s${i}`, name: `S${i}`, bot: true }));
    let state = def.start(seats, def.options(options), rng);
    for (let i = 0; i < 20000 && !def.over(state); i++) {
      if (def.betweenRounds(state)) state = def.nextRound(state, rng);
      else {
        const seat = def.actors(state)[0];
        state = def.apply(state, seat, def.auto(state, seat, rng), rng);
      }
    }
    assert.ok(def.over(state));
    const winners = def.winners(state);
    assert.ok(winners.length >= 1);
    assert.ok(winners.every((s) => s >= 0 && s < count));
    if (game === 'belote') assert.equal(winners.length, 2);
  });
}
