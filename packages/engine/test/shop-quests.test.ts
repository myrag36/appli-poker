import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_AVATAR_EMOJIS,
  AVATAR_EMOJIS,
  SHOP_ITEMS,
  avatarEmojisFor,
  cleanEquipped,
  isUnlocked,
  nextReward,
  ownedKey,
  parisDay,
  questProgress,
  questsFor,
  rewardsAtLevel,
} from '../src/index.ts';

test('shop items need to be bought, whatever the level', () => {
  assert.equal(isUnlocked('frame', 'sakura', 50), false);
  assert.equal(isUnlocked('frame', 'sakura', 1, [ownedKey('frame', 'sakura')]), true);
  // Same id in another kind does not count.
  assert.equal(isUnlocked('cardBack', 'sakura', 1, [ownedKey('frame', 'sakura')]), false);
  assert.equal(isUnlocked('frame', 'gold', 10, []), true);
});

test('cleanEquipped keeps bought items and drops the rest', () => {
  const owned = [ownedKey('banner', 'forest')];
  assert.equal(cleanEquipped({ banner: 'forest' }, 1, owned).banner, 'forest');
  assert.equal(cleanEquipped({ banner: 'forest' }, 50, []).banner, 'felt');
});

test('shop items never show up as level rewards', () => {
  for (let l = 1; l <= 50; l++) assert.ok(rewardsAtLevel(l).every((x) => x.price === undefined));
  assert.equal(nextReward(1)?.price, undefined);
});

test('bought avatars become available; every emoji is unique', () => {
  assert.ok(!avatarEmojisFor(50).includes('🧛'));
  assert.ok(avatarEmojisFor(1, [ownedKey('avatar', '🧛')]).includes('🧛'));
  assert.equal(new Set(ALL_AVATAR_EMOJIS).size, ALL_AVATAR_EMOJIS.length);
  assert.ok(SHOP_ITEMS.every((x) => x.kind !== 'avatar' || !AVATAR_EMOJIS.includes(x.id)));
});

test('three quests a day, the same for everyone, and progress from the day stats', () => {
  const quests = questsFor('2026-10-07');
  assert.equal(quests.length, 3);
  assert.deepEqual(questsFor('2026-10-07'), quests);
  assert.equal(new Set(quests.map((q) => q.id)).size, 3);
  const stats = { played: { yams: 2, belote: 1, poker: 1 }, won: { yams: 1 }, rounds: 20 };
  assert.equal(questProgress({ id: 'play:3', text: '', target: 3, coins: 40 }, stats), 3);
  assert.equal(questProgress({ id: 'win:2', text: '', target: 2, coins: 70 }, stats), 1);
  assert.equal(questProgress({ id: 'playgame:yams', text: '', target: 2, coins: 40 }, stats), 2);
  assert.equal(questProgress({ id: 'wingame:belote', text: '', target: 1, coins: 60 }, stats), 0);
  assert.equal(questProgress({ id: 'variety:3', text: '', target: 3, coins: 70 }, stats), 3);
  assert.equal(questProgress({ id: 'rounds:15', text: '', target: 15, coins: 60 }, stats), 15);
  assert.equal(questProgress({ id: 'play:3', text: '', target: 3, coins: 40 }, {}), 0);
});

test('the day follows Paris time', () => {
  assert.equal(parisDay(new Date('2026-10-07T22:30:00Z')), '2026-10-08');
  assert.equal(parisDay(new Date('2026-10-07T21:30:00Z')), '2026-10-07');
});
