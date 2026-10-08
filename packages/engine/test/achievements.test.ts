import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, achievementProgress, rollChest, streakCoins, xpForLevel } from '../src/index.ts';

const empty = { games: {}, xp: 0, bestStreak: 0, owned: 0, questsDone: 0, feats: [] };

test('the streak bonus grows each day up to a week', () => {
  assert.deepEqual([1, 2, 7, 30].map(streakCoins), [10, 20, 70, 70]);
});

test('chests always give coins, big ones more', () => {
  for (let i = 0; i < 50; i++) {
    const r = Math.random;
    const n = rollChest('normal', r);
    const g = rollChest('grand', r);
    assert.ok(n.coins >= 30 && n.coins <= 80);
    assert.ok(g.coins >= 100 && g.coins <= 250);
  }
});

test('achievement ids are unique and progress is measured on the stats', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const stats = {
    ...empty,
    games: { yams: { played: 12, won: 4 }, poker: { played: 3, won: 0 } },
    xp: xpForLevel(12),
    bestStreak: 4,
    feats: ['capot'],
  };
  assert.equal(achievementProgress('played-10', stats), 10);
  assert.equal(achievementProgress('won-10', stats), 4);
  assert.equal(achievementProgress('all-games', stats), 2);
  assert.equal(achievementProgress('level-10', stats), 10);
  assert.equal(achievementProgress('streak-7', stats), 4);
  assert.equal(achievementProgress('feat-capot', stats), 1);
  assert.equal(achievementProgress('feat-yams', stats), 0);
  assert.equal(achievementProgress('first-win', empty), 0);
});
