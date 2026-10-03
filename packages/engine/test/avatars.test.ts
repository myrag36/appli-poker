import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_COLORS, AVATAR_EMOJIS, cleanAvatar, defaultAvatar } from '../src/avatars.ts';

test('un avatar inconnu est remplacé par celui par défaut', () => {
  const fallback = defaultAvatar(1);
  assert.deepEqual(cleanAvatar({ emoji: '🦊', color: AVATAR_COLORS[2] }, fallback), { emoji: '🦊', color: AVATAR_COLORS[2] });
  assert.deepEqual(cleanAvatar({ emoji: '<script>', color: 'red' }, fallback), fallback);
  assert.deepEqual(cleanAvatar(null, fallback), fallback);
});

test('chaque place a un avatar différent', () => {
  const emojis = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => defaultAvatar(s).emoji));
  assert.equal(emojis.size, 8);
  assert.ok(AVATAR_EMOJIS.includes(defaultAvatar(3).emoji));
});
