import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bigBlindAt, blindLevel } from '../src/tournament.ts';

test('les blindes montent à chaque niveau et restent paires', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((l) => bigBlindAt(20, l)), [20, 30, 40, 60, 80]);
  assert.equal(bigBlindAt(10, 1), 16);
  assert.equal(bigBlindAt(20, 99), 1280);
});

test('le niveau dépend du temps écoulé depuis le début', () => {
  const start = 1_000_000;
  assert.deepEqual(blindLevel(start, start, 10), { level: 0, nextLevelAt: start + 600_000 });
  assert.deepEqual(blindLevel(start, start + 600_000, 10), { level: 1, nextLevelAt: start + 1_200_000 });
  assert.deepEqual(blindLevel(start, start + 1_799_999, 10).level, 2);
});
