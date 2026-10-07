import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questsFor, xpForLevel } from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';
import {
  chestContents,
  cleanFeat,
  cleanFriendCode,
  podiumChest,
  equip,
  finishedQuest,
  localGame,
  reachedAchievement,
  shopItem,
} from './logic.ts';

test('only unlocked rewards can be worn, the rest of the outfit stays', () => {
  assert.throws(() => equip(0, {}, 'frame', 'gold'), /Pas encore/);
  assert.throws(() => equip(0, {}, 'hat', 'gold'), GameError);
  const at10 = xpForLevel(10);
  const worn = equip(at10, { title: 'habitue', frame: 'legend' }, 'frame', 'gold');
  assert.deepEqual(worn, { frame: 'gold', title: 'habitue', cardBack: 'classic', banner: 'felt' });
});

test('a game on one phone pays like a game online', () => {
  assert.deepEqual(localGame('yams', true), { game: 'yams', amount: 50, coins: 25, won: true });
  assert.deepEqual(localGame('belote', 'yes'), { game: 'belote', amount: 20, coins: 10, won: false });
  assert.throws(() => localGame('morpion', true), /Jeu inconnu/);
});

test('bought items can be worn, at any level', () => {
  assert.throws(() => equip(xpForLevel(50), {}, 'frame', 'diamond', []), /Pas encore/);
  assert.equal(equip(0, {}, 'frame', 'diamond', ['frame:diamond']).frame, 'diamond');
});

test('a game on one phone also pays coins', () => {
  assert.equal(localGame('yams', true).coins, 25);
  assert.equal(localGame('yams', false).coins, 10);
});

test('only real shop items at their real price', () => {
  assert.deepEqual(shopItem('frame', 'sakura', 3), { key: 'frame:sakura', price: 300 });
  assert.throws(() => shopItem('frame', 'gold'), /introuvable/);
  assert.throws(() => shopItem('frame', 'nope'), /introuvable/);
});

test('a quest pays only when finished, today', () => {
  const day = '2026-10-07';
  const [easy] = questsFor(day);
  const enough = { played: { yams: easy.target } };
  assert.equal(finishedQuest(day, easy.id, day, enough).coins, easy.coins);
  assert.throws(() => finishedQuest(day, easy.id, day, { played: { yams: 1 } }), /pas encore/);
  assert.throws(() => finishedQuest(day, easy.id, '2026-10-06', enough), /pas encore/);
  assert.throws(() => finishedQuest(day, 'play:99', day, enough), /terminée/);
});

test('a chest gives coins and maybe a shop item the player does not have', () => {
  const always = () => 0;
  const got = chestContents('grand', [], always, 3);
  assert.equal(got.coins, 100);
  assert.equal(got.item, 'frame:sakura');
  assert.equal(chestContents('grand', ['frame:sakura'], always, 3).item, 'frame:lagoon');
  assert.equal(chestContents('normal', [], () => 0.99).item, null);
});

test('achievements pay only once reached', () => {
  assert.equal(reachedAchievement('first-win', { games: { yams: { played: 1, won: 1 } } }).coins, 30);
  assert.throws(() => reachedAchievement('first-win', { games: {} }), /pas encore/);
  assert.throws(() => reachedAchievement('nope', {}), /inconnu/);
  assert.equal(reachedAchievement('feat-yams', { feats: ['yams'] }).id, 'feat-yams');
  assert.throws(() => cleanFeat('triche'), /inconnu/);
});

test('seasonal items are only for sale during their month', () => {
  assert.deepEqual(shopItem('frame', 'halloween', 10), { key: 'frame:halloween', price: 600 });
  assert.throws(() => shopItem('frame', 'halloween', 11), /plus en vente/);
  assert.deepEqual(shopItem('emote', '🐔', 3), { key: 'emote:🐔', price: 150 });
});

test('friend codes are 6 letters or digits', () => {
  assert.equal(cleanFriendCode(' k7p-q2m '), 'K7PQ2M');
  assert.throws(() => cleanFriendCode('abc'), /6 caractères/);
});

test('last week podium among friends', () => {
  const board = [
    { user_id: 'a', xp: 500 },
    { user_id: 'b', xp: 300 },
    { user_id: 'c', xp: 200 },
    { user_id: 'd', xp: 100 },
    { user_id: 'e', xp: 0 },
  ];
  assert.equal(podiumChest('a', board), 'grand');
  assert.equal(podiumChest('c', board), 'normal');
  assert.equal(podiumChest('d', board), null);
  assert.equal(podiumChest('e', board), null);
  assert.equal(podiumChest('a', [{ user_id: 'a', xp: 900 }]), null);
});
