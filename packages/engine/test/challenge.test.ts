import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_GAMES,
  challengeFor,
  challengeProgress,
  challengeStreakBonus,
  liveChallengeStreak,
  questsFor,
} from '../src/index.ts';

function days(from: string, count: number): string[] {
  const start = Date.parse(`${from}T12:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

test('the challenge is the same all day and changes every day', () => {
  assert.deepEqual(challengeFor('2026-10-08'), challengeFor('2026-10-08'));
  const month = days('2026-10-01', 30).map((d) => challengeFor(d).id);
  for (let i = 1; i < month.length; i++) assert.notEqual(month[i], month[i - 1]);
});

test('every game comes up within a month, both to win and to play, plus general challenges', () => {
  const ids = new Set(days('2026-10-01', 60).map((d) => challengeFor(d).id));
  for (const g of CHALLENGE_GAMES) {
    assert.ok(ids.has(`wingame:${g}`), `wingame:${g}`);
    assert.ok(ids.has(`playgame:${g}`), `playgame:${g}`);
  }
  for (const id of ['discover', 'win:4', 'variety:5', 'winvariety:3', 'rounds:30'])
    assert.ok(ids.has(id), id);
});

test('a challenge pays about three quests', () => {
  const quest = Math.max(...questsFor('2026-10-08').map((q) => q.coins));
  for (const d of days('2026-10-01', 30)) {
    const c = challengeFor(d);
    assert.ok(c.coins >= 150 && c.coins >= 2 * quest, `${c.id} ${c.coins}`);
    assert.ok(c.text.length > 0 && c.emoji.length > 0);
  }
});

test('progress counts today’s games and stops at the target', () => {
  const win = { id: 'wingame:tarot', text: '', hint: '', emoji: '', target: 2, coins: 180 };
  assert.equal(challengeProgress(win, {}), 0);
  assert.equal(challengeProgress(win, { won: { tarot: 1, uno: 3 } }), 1);
  assert.equal(challengeProgress(win, { won: { tarot: 5 } }), 2);
  const wv = { ...win, id: 'winvariety:3', target: 3 };
  assert.equal(challengeProgress(wv, { won: { tarot: 1, uno: 2 } }), 2);
  const r = { ...win, id: 'rounds:30', target: 30 };
  assert.equal(challengeProgress(r, { rounds: 12 }), 12);
});

test('discover: a game played for the first time today', () => {
  const disc = { id: 'discover', text: '', hint: '', emoji: '', target: 1, coins: 150 };
  // Played Uno before, only Uno today: not new.
  assert.equal(challengeProgress(disc, { played: { uno: 1 } }, { uno: { played: 4, won: 1 } }), 0);
  // Tarot played twice, both today: new.
  assert.equal(challengeProgress(disc, { played: { tarot: 2 } }, { tarot: { played: 2, won: 0 } }), 1);
  // Everything already tried before today: three different games instead.
  const all = Object.fromEntries(CHALLENGE_GAMES.map((g) => [g, { played: 5, won: 0 }]));
  assert.equal(challengeProgress(disc, { played: { uno: 1, yams: 1 } }, all), 0);
  assert.equal(challengeProgress(disc, { played: { uno: 1, yams: 1, rami: 1 } }, all), 1);
});

test('challenge streak: bonus from the second day, capped; lost after a missed day', () => {
  assert.equal(challengeStreakBonus(1), 0);
  assert.equal(challengeStreakBonus(2), 20);
  assert.equal(challengeStreakBonus(30), 100);
  assert.equal(liveChallengeStreak('2026-10-07', 3, '2026-10-08'), 3);
  assert.equal(liveChallengeStreak('2026-10-08', 3, '2026-10-08'), 3);
  assert.equal(liveChallengeStreak('2026-10-06', 3, '2026-10-08'), 0);
  assert.equal(liveChallengeStreak(null, 3, '2026-10-08'), 0);
});
