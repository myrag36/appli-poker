import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForLevel } from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';
import { equip, localGame } from './logic.ts';

test('only unlocked rewards can be worn, the rest of the outfit stays', () => {
  assert.throws(() => equip(0, {}, 'frame', 'gold'), /Pas encore/);
  assert.throws(() => equip(0, {}, 'hat', 'gold'), GameError);
  const at10 = xpForLevel(10);
  const worn = equip(at10, { title: 'habitue', frame: 'legend' }, 'frame', 'gold');
  assert.deepEqual(worn, { frame: 'gold', title: 'habitue', cardBack: 'classic', banner: 'felt' });
});

test('a game on one phone pays like a game online', () => {
  assert.deepEqual(localGame('yams', true), { game: 'yams', amount: 50, won: true });
  assert.deepEqual(localGame('belote', 'yes'), { game: 'belote', amount: 20, won: false });
  assert.throws(() => localGame('morpion', true), /Jeu inconnu/);
});
