import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_KINDS,
  DEFAULT_EQUIPPED,
  EQUIP_SLOTS,
  REWARDS,
  SHOP_ITEMS,
  boughtCount,
  cleanEquipped,
  conditionProgress,
  findAchievement,
  forSale,
  isUnlocked,
  nextReward,
  ownedKey,
  pendingUnlocks,
  rarityOf,
  rewardsAtLevel,
  unlockStats,
  unlockText,
  xpForLevel,
} from '../src/index.ts';

const count = (kind: string) => REWARDS.filter((r) => r.kind === kind).length;

test('the catalog is big enough, with unique ids per kind and known achievements', () => {
  assert.ok(count('cardBack') >= 12);
  assert.ok(count('chip') >= 8);
  assert.ok(count('felt') >= 8);
  assert.ok(count('frame') >= 10);
  for (const kind of CUSTOM_KINDS) {
    const ids = REWARDS.filter((r) => r.kind === kind).map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, kind);
  }
  for (const r of REWARDS) {
    if (r.unlock && 'achievement' in r.unlock) assert.ok(findAchievement(r.unlock.achievement), r.id);
    // An item comes one way only: level, price, or by playing.
    assert.ok(!(r.unlock && r.price !== undefined), r.id);
  }
  // Each customization kind has items of every way and several rarities.
  for (const kind of ['cardBack', 'chip', 'felt'] as const) {
    const items = REWARDS.filter((r) => r.kind === kind);
    assert.ok(items.some((r) => r.price !== undefined));
    assert.ok(items.some((r) => r.unlock));
    assert.ok(items.some((r) => r.level > 1 && r.price === undefined && !r.unlock));
    assert.ok(new Set(items.map(rarityOf)).size >= 3, kind);
  }
});

test('every slot has a free default, worn by a new player', () => {
  for (const slot of EQUIP_SLOTS) assert.ok(isUnlocked(slot, DEFAULT_EQUIPPED[slot], 1, []), slot);
  assert.deepEqual(cleanEquipped({}, 1, []), DEFAULT_EQUIPPED);
});

test('level items unlock with the level, chips and felts too', () => {
  assert.equal(isUnlocked('chip', 'neon', 27), false);
  assert.equal(isUnlocked('chip', 'neon', 28), true);
  assert.equal(isUnlocked('felt', 'velours', 36), true);
  assert.ok(rewardsAtLevel(8).some((r) => r.kind === 'chip' && r.id === 'argile'));
  assert.equal(cleanEquipped({ felt: 'velours', chip: 'or' }, 10).felt, 'ambiance');
  assert.equal(cleanEquipped({ felt: 'velours', chip: 'or' }, 50).chip, 'or');
});

test('items earned by playing are never level rewards and need to be in the collection', () => {
  for (let l = 1; l <= 50; l++) assert.ok(rewardsAtLevel(l).every((r) => !r.unlock));
  assert.ok(!nextReward(1)?.unlock);
  assert.equal(isUnlocked('felt', 'champion', 50, []), false);
  assert.equal(isUnlocked('felt', 'champion', 1, [ownedKey('felt', 'champion')]), true);
  assert.ok(SHOP_ITEMS.every((r) => !r.unlock));
});

test('achievements and daily challenges make items due, once', () => {
  const row = { xp: 0, games: {}, owned: [], challenges_done: 0 };
  assert.deepEqual(pendingUnlocks(unlockStats(row), []), []);

  // Three challenges: the challenge felt, not yet the chips (5).
  let due = pendingUnlocks(unlockStats({ ...row, challenges_done: 3 }), []).map((r) => `${r.kind}:${r.id}`);
  assert.deepEqual(due, ['felt:defi']);
  due = pendingUnlocks(unlockStats({ ...row, challenges_done: 12 }), []).map((r) => `${r.kind}:${r.id}`);
  assert.deepEqual(due.sort(), ['cardBack:medaille', 'chip:defi', 'felt:defi']);
  // Already in the collection: not due again.
  assert.deepEqual(pendingUnlocks(unlockStats({ ...row, challenges_done: 3 }), [ownedKey('felt', 'defi')]), []);

  // 10 poker wins: the shark chips; 5 different games: the compass back.
  const games = {
    poker: { played: 12, won: 10 },
    yams: { played: 1, won: 0 },
    uno: { played: 1, won: 0 },
    tarot: { played: 1, won: 0 },
    belote: { played: 1, won: 0 },
  };
  const ids = pendingUnlocks(unlockStats({ ...row, games }), []).map((r) => r.id);
  assert.ok(ids.includes('requin'));
  assert.ok(ids.includes('boussole'));
  assert.ok(!ids.includes('phoenix'));
  assert.deepEqual(conditionProgress({ achievement: 'won-50' }, unlockStats({ ...row, games })), {
    done: 10,
    target: 50,
  });
  // A carré at poker: the lucky clover frame.
  assert.ok(pendingUnlocks(unlockStats({ ...row, feats: ['carre'] }), []).some((r) => r.id === 'trefle'));
  // The level alone earns nothing here: level items need no unlocking.
  assert.deepEqual(pendingUnlocks(unlockStats({ ...row, xp: xpForLevel(50) }), []), []);
});

test('earned items do not count as purchases for the shopping achievements', () => {
  const owned = [ownedKey('felt', 'defi'), ownedKey('chip', 'requin'), ownedKey('frame', 'sakura')];
  assert.equal(boughtCount(owned), 1);
  assert.equal(unlockStats({ owned }).owned, 1);
});

test('seasonal table items are only for sale in their month', () => {
  const web = SHOP_ITEMS.find((r) => r.kind === 'cardBack' && r.id === 'araignee')!;
  assert.equal(forSale(web, 10), true);
  assert.equal(forSale(web, 11), false);
});

test('rarity and how to unlock, for the tiles', () => {
  const find = (kind: string, id: string) => REWARDS.find((r) => r.kind === kind && r.id === id)!;
  assert.equal(rarityOf(find('felt', 'brocart')), 'legendaire');
  assert.equal(rarityOf(find('frame', 'bronze')), 'commun');
  assert.equal(rarityOf(find('frame', 'legend')), 'legendaire');
  assert.deepEqual(unlockText(find('chip', 'neon')), { text: 'Niveau {n}', vars: { n: 28 } });
  assert.deepEqual(unlockText(find('chip', 'pixel')), { text: '{n} pièces', vars: { n: 300 } });
  assert.deepEqual(unlockText(find('chip', 'defi')), { text: 'Réussis {n} défis du jour', vars: { n: 5 } });
  assert.deepEqual(unlockText(find('chip', 'requin')), {
    text: 'Succès « {name} »',
    vars: { name: 'Requin du poker' },
  });
});
