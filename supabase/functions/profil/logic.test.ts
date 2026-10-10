import { test } from 'node:test';
import assert from 'node:assert/strict';
import { challengeFor, questsFor, xpForLevel } from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';
import {
  chestContents,
  cleanFeat,
  cleanFriendCode,
  equip,
  finishedQuest,
  finishedChallenge,
  localGame,
  reachedAchievement,
  shopItem,
  weekXpOf,
  weeklyLeaderboard,
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

test('experience of this week and last week, as the database keeps it', () => {
  const monday = '2026-10-05';
  assert.deepEqual(
    weekXpOf(
      { user_id: 'a', week_start: monday, week_xp: 120, last_week_start: '2026-09-28', last_week_xp: 80 },
      monday,
    ),
    { week: 120, lastWeek: 80 },
  );
  // No experience since last week: the database has not moved the weeks on yet.
  assert.deepEqual(weekXpOf({ user_id: 'a', week_start: '2026-09-28', week_xp: 70 }, monday), {
    week: 0,
    lastWeek: 70,
  });
  // Nothing for two weeks.
  assert.deepEqual(
    weekXpOf(
      { user_id: 'a', week_start: '2026-09-21', week_xp: 70, last_week_start: '2026-09-14', last_week_xp: 9 },
      monday,
    ),
    { week: 0, lastWeek: 0 },
  );
  assert.deepEqual(weekXpOf({ user_id: 'a' }, monday), { week: 0, lastWeek: 0 });
});

test('the daily challenge is paid only once done, with today’s stats', () => {
  const day = '2026-10-10';
  const c = challengeFor(day);
  assert.equal(c.id, 'wingame:tarot');
  assert.throws(() => finishedChallenge(day, day, { won: { tarot: 1 } }, {}), /pas encore/);
  // Yesterday's wins do not count.
  assert.throws(() => finishedChallenge(day, '2026-10-08', { won: { tarot: 2 } }, {}), /pas encore/);
  assert.equal(finishedChallenge(day, day, { won: { tarot: 2 } }, {}).coins, c.coins);
});

test('weekly ranking between friends: online games of this week, and last week’s podium', () => {
  const monday = '2026-10-05';
  const r = (user_id: string, game: string, won: boolean, week = monday) => ({ user_id, game, won, week });
  const board = weeklyLeaderboard(
    'moi',
    [
      {
        user_id: 'moi',
        name: 'Simon',
        xp: 1200,
        equipped: { frame: 'gold' },
        week_start: monday,
        week_xp: 90,
      },
      {
        user_id: 'lea',
        name: 'Léa',
        avatar: '🦄',
        avatar_color: '#8e7dbe',
        week_start: '2026-09-28',
        week_xp: 40,
      },
      { user_id: 'tom', week_start: monday, week_xp: 300, last_week_start: '2026-09-28', last_week_xp: 10 },
    ],
    [
      r('moi', 'uno', true),
      r('moi', 'poker', false),
      r('lea', 'uno', true),
      r('lea', 'uno', true),
      r('lea', 'yams', false),
      r('tom', 'poker', true, '2026-09-28'),
      r('moi', 'poker', false, '2026-09-28'),
      r('lea', 'tarot', true, '2026-09-21'),
    ],
    monday,
    Date.UTC(2026, 9, 8, 10),
  );
  assert.equal(board.week, monday);
  assert.equal(board.lastWeek, '2026-09-28');
  assert.equal(board.endsAt, Date.UTC(2026, 9, 11, 22));
  assert.ok(board.games.includes('poker') && board.games.includes('uno'));
  assert.deepEqual(board.ranking, [
    { user_id: 'lea', place: 1, played: 3, won: 2, points: 7, xp: 0, best: 'uno' },
    { user_id: 'moi', place: 2, played: 2, won: 1, points: 4, xp: 90, best: 'uno' },
    { user_id: 'tom', place: 3, played: 0, won: 0, points: 0, xp: 300, best: null },
  ]);
  assert.deepEqual(
    board.podium.map((p) => [p.user_id, p.place, p.points]),
    [
      ['tom', 1, 3],
      ['moi', 2, 1],
    ],
  );
  // I was second last week, with Tom: a chest (taken once, see `claim_podium`).
  assert.equal(board.chest, 'normal');
  const tom = board.players.find((p) => p.user_id === 'tom')!;
  assert.equal(tom.lastWeekXp, 10);
  assert.equal(board.players.find((p) => p.user_id === 'lea')!.lastWeekXp, 40);
  assert.equal(tom.name, 'Joueur');
  assert.equal(tom.me, false);
  assert.equal(board.players.find((p) => p.user_id === 'moi')!.me, true);
});
