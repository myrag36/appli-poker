import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type LeaderboardPlayer,
  ONLINE_GAMES,
  leaderboardGames,
  leaderboardPodium,
  leaderboardPoints,
  previousWeek,
  rankLeaderboard,
  tallyResults,
  weekEndsAt,
} from '../src/index.ts';

function player(id: string, week: LeaderboardPlayer['week'], lastWeek: LeaderboardPlayer['lastWeek'] = {}) {
  return {
    user_id: id,
    name: id,
    avatar: null,
    avatar_color: null,
    xp: 0,
    equipped: {},
    owned: [],
    me: id === 'moi',
    week,
    lastWeek,
  };
}

test('every online game can be picked, poker included', () => {
  const games = leaderboardGames();
  assert.equal(games[0], 'poker');
  for (const g of Object.keys(ONLINE_GAMES)) assert.ok(games.includes(g));
});

test('a win is worth 3 points, any other game 1', () => {
  assert.equal(leaderboardPoints({ played: 5, won: 2 }), 9);
  assert.equal(leaderboardPoints({ played: 0, won: 0 }), 0);
});

test('results are counted for this week and last week only', () => {
  const rows = [
    { user_id: 'a', game: 'uno', won: true, week: '2026-10-05' },
    { user_id: 'a', game: 'uno', won: false, week: '2026-10-05' },
    { user_id: 'a', game: 'poker', won: true, week: '2026-09-28' },
    { user_id: 'a', game: 'poker', won: true, week: '2026-09-21' },
    { user_id: 'b', game: 'yams', won: false, week: '2026-10-05' },
  ];
  const t = tallyResults(rows, '2026-10-05');
  assert.deepEqual(t.get('a'), {
    week: { uno: { played: 2, won: 1 } },
    lastWeek: { poker: { played: 1, won: 1 } },
  });
  assert.deepEqual(t.get('b'), { week: { yams: { played: 1, won: 0 } }, lastWeek: {} });
  assert.equal(previousWeek('2026-03-02'), '2026-02-23');
});

test('the ranking orders by points, then wins, and ties share a place', () => {
  const players = [
    player('moi', { uno: { played: 3, won: 1 } }),
    player('lea', { uno: { played: 1, won: 1 }, yams: { played: 2, won: 0 } }),
    player('tom', { poker: { played: 4, won: 2 } }),
    player('zoe', {}),
  ];
  const lines = rankLeaderboard(players, 'week');
  assert.deepEqual(
    lines.map((l) => [l.player.user_id, l.place, l.points, l.best]),
    [
      ['tom', 1, 8, 'poker'],
      ['moi', 2, 5, 'uno'],
      ['lea', 2, 5, 'uno'],
      ['zoe', 4, 0, null],
    ],
  );
  const uno = rankLeaderboard(players, 'week', 'uno');
  assert.deepEqual(
    uno.map((l) => [l.player.user_id, l.place, l.played, l.won]),
    [
      ['moi', 1, 3, 1],
      ['lea', 2, 1, 1],
      ['tom', 3, 0, 0],
      ['zoe', 3, 0, 0],
    ],
  );
});

test('the podium only has players who played last week', () => {
  const players = [
    player('moi', {}, { uno: { played: 1, won: 0 } }),
    player('lea', {}, { uno: { played: 2, won: 2 } }),
    player('tom', {}, {}),
  ];
  assert.deepEqual(
    leaderboardPodium(players).map((l) => [l.player.user_id, l.place]),
    [
      ['lea', 1],
      ['moi', 2],
    ],
  );
  assert.deepEqual(leaderboardPodium(players, 'poker'), []);
});

test('the week ends on Monday at midnight in Paris, summer and winter time', () => {
  // Thursday 8 October 2026, noon in Paris (summer time, UTC+2).
  assert.equal(weekEndsAt(Date.UTC(2026, 9, 8, 10)), Date.UTC(2026, 9, 11, 22));
  // Sunday 1 November 2026, 23:30 in Paris (winter time, UTC+1).
  assert.equal(weekEndsAt(Date.UTC(2026, 10, 1, 22, 30)), Date.UTC(2026, 10, 1, 23));
  // Monday 2 November 2026, 00:00 in Paris: a new week has just started.
  assert.equal(weekEndsAt(Date.UTC(2026, 10, 1, 23)), Date.UTC(2026, 10, 8, 23));
});
