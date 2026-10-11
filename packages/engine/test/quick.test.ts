import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ELO_FLOOR,
  ELO_K,
  ELO_K_NEW,
  ONLINE_GAMES,
  QUICK_GAMES,
  QUICK_GAME_IDS,
  eloDeltaLabel,
  eloDeltas,
  eloExpected,
  isQuickGame,
  quickRequest,
} from '../src/index.ts';

test('every online game and poker can be found with strangers', () => {
  assert.deepEqual(QUICK_GAME_IDS.slice().sort(), ['poker', ...Object.keys(ONLINE_GAMES)].sort());
  assert.ok(isQuickGame('poker'));
  assert.ok(isQuickGame('uno'));
  assert.ok(!isQuickGame('toString'));
  assert.ok(!isQuickGame('loto'));
});

test('quick tables have valid settings and sizes for their game', () => {
  for (const id of Object.keys(ONLINE_GAMES) as (keyof typeof ONLINE_GAMES)[]) {
    const def = ONLINE_GAMES[id];
    const quick = QUICK_GAMES[id];
    // The settings are accepted as they are by the game.
    assert.deepEqual(def.options(quick.options), quick.options, id);
    assert.ok(quick.sizes.includes(quick.size), id);
    for (const size of quick.sizes) {
      assert.ok(size >= 2 && size <= def.maxPlayers, `${id} ${size}`);
      assert.ok(size >= def.minPlayers, `${id} ${size}`);
    }
  }
  assert.ok(QUICK_GAMES.poker.sizes.every((s) => s >= 2 && s <= 8));
});

test('a request falls back to the default size and the first variant', () => {
  assert.deepEqual(quickRequest('uno'), { game: 'uno', size: 3, variant: '' });
  assert.deepEqual(quickRequest('uno', { size: 4 }), { game: 'uno', size: 4, variant: '' });
  assert.deepEqual(quickRequest('uno', { size: 9 }), { game: 'uno', size: 3, variant: '' });
  assert.deepEqual(quickRequest('echecs', { size: 4 }), { game: 'echecs', size: 2, variant: '' });
  assert.deepEqual(quickRequest('poker', { variant: 'omaha', size: 2 }), {
    game: 'poker',
    size: 2,
    variant: 'omaha',
  });
  assert.deepEqual(quickRequest('poker', { variant: 'stud' }), { game: 'poker', size: 4, variant: 'holdem' });
  assert.deepEqual(quickRequest('yams', { variant: 'omaha' }).variant, '');
});

test('expected scores follow the Elo curve', () => {
  assert.equal(eloExpected(1000, 1000), 0.5);
  assert.ok(Math.abs(eloExpected(1400, 1000) - 0.909) < 0.001);
  assert.ok(Math.abs(eloExpected(1000, 1400) + eloExpected(1400, 1000) - 1) < 1e-12);
});

test('a duel between equals moves half of K, both ways', () => {
  const d = eloDeltas([
    { id: 'a', rating: 1000, games: 30, place: 1 },
    { id: 'b', rating: 1000, games: 30, place: 2 },
  ]);
  assert.deepEqual(d, { a: ELO_K / 2, b: -ELO_K / 2 });
  const fresh = eloDeltas([
    { id: 'a', rating: 1000, games: 0, place: 1 },
    { id: 'b', rating: 1000, games: 0, place: 2 },
  ]);
  assert.deepEqual(fresh, { a: ELO_K_NEW / 2, b: -ELO_K_NEW / 2 });
});

test('beating a much stronger player pays more than beating a weaker one', () => {
  const upset = eloDeltas([
    { id: 'low', rating: 900, games: 30, place: 1 },
    { id: 'high', rating: 1300, games: 30, place: 2 },
  ]);
  const expected = eloDeltas([
    { id: 'low', rating: 900, games: 30, place: 2 },
    { id: 'high', rating: 1300, games: 30, place: 1 },
  ]);
  assert.ok(upset.low > 25);
  assert.ok(expected.high >= 1 && expected.high < 5);
  assert.equal(upset.low, -upset.high);
});

test('a winner always gains and a lone loser always loses, even against far weaker players', () => {
  const d = eloDeltas([
    { id: 'pro', rating: 2400, games: 50, place: 1 },
    { id: 'new', rating: 800, games: 50, place: 2 },
  ]);
  assert.equal(d.pro, 1);
  assert.equal(d.new, -1);
});

test('a draw between equals changes nothing', () => {
  assert.deepEqual(
    eloDeltas([
      { id: 'a', rating: 1100, games: 20, place: 1 },
      { id: 'b', rating: 1100, games: 20, place: 1 },
    ]),
    { a: 0, b: 0 },
  );
});

test('at a bigger table each duel weighs less, and the winner takes from everyone', () => {
  const d = eloDeltas([
    { id: 'w', rating: 1000, games: 30, place: 1 },
    { id: 'x', rating: 1000, games: 30, place: 2 },
    { id: 'y', rating: 1000, games: 30, place: 2 },
    { id: 'z', rating: 1000, games: 30, place: 2 },
  ]);
  // Three duels won at K/3 each: as much as one duel won in chess.
  assert.equal(d.w, 16);
  for (const id of ['x', 'y', 'z']) assert.equal(d[id], -5);
});

test('a single person (only robots around) changes nothing', () => {
  assert.deepEqual(eloDeltas([{ id: 'a', rating: 1000, games: 0, place: 1 }]), {});
  assert.deepEqual(eloDeltas([]), {});
});

test('a rating never falls below the floor', () => {
  const d = eloDeltas([
    { id: 'a', rating: ELO_FLOOR + 3, games: 0, place: 2 },
    { id: 'b', rating: ELO_FLOOR + 3, games: 0, place: 1 },
  ]);
  assert.equal(d.a, -3);
  assert.equal(d.b, 24);
});

test('changes are shown with their sign', () => {
  assert.equal(eloDeltaLabel(12), '+12');
  assert.equal(eloDeltaLabel(-8), '−8');
  assert.equal(eloDeltaLabel(0), '±0');
});
