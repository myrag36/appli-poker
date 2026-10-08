import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS, SHOP_ITEMS, emotesFor, forSale, monthOf, seasonDaysLeft, weekStart } from '../src/index.ts';

test('every month has a season and three items for sale only then', () => {
  assert.equal(SEASONS.length, 12);
  for (let m = 1; m <= 12; m++) {
    assert.equal(SHOP_ITEMS.filter((x) => x.season === m).length, 3);
    const other = SHOP_ITEMS.find((x) => x.season === (m % 12) + 1)!;
    assert.equal(forSale(other, m), false);
  }
});

test('dates: month, days left and the Monday of the week', () => {
  assert.equal(monthOf('2026-10-07'), 10);
  assert.equal(seasonDaysLeft('2026-10-07'), 25);
  assert.equal(seasonDaysLeft('2026-02-28'), 1);
  assert.equal(weekStart('2026-10-07'), '2026-10-05');
  assert.equal(weekStart('2026-10-05'), '2026-10-05');
  assert.equal(weekStart('2026-10-11'), '2026-10-05');
});

test('bought emotes join the free ones', () => {
  assert.equal(emotesFor([]).length, 8);
  assert.ok(emotesFor(['emote:🐔']).includes('🐔'));
});
