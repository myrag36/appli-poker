import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type LeaderboardPlayer,
  ONLINE_GAMES,
  leaderboardChest,
  leaderboardGames,
  leaderboardPodium,
  leaderboardPoints,
  previousWeek,
  rankLeaderboard,
  tallyResults,
  weekEndsAt,
} from '../src/index.ts';

function player(
  id: string,
  week: LeaderboardPlayer['week'],
  lastWeek: LeaderboardPlayer['lastWeek'] = {},
  weekXp = 0,
  lastWeekXp = 0,
): LeaderboardPlayer {
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
    weekXp,
    lastWeekXp,
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

test('between equal points and wins, the experience of the week decides (all games only)', () => {
  const players = [
    player('moi', { uno: { played: 2, won: 1 } }, {}, 300),
    player('lea', { yams: { played: 2, won: 1 } }, {}, 450),
    player('tom', { poker: { played: 2, won: 1 } }, {}, 300),
    player('zoe', {}, {}, 900),
    player('max', {}, {}, 0),
  ];
  assert.deepEqual(
    rankLeaderboard(players, 'week').map((l) => [l.player.user_id, l.place, l.points, l.xp]),
    [
      ['lea', 1, 4, 450],
      ['moi', 2, 4, 300],
      ['tom', 2, 4, 300],
      // Experience without an online game ranks below, but still in order.
      ['zoe', 4, 0, 900],
      ['max', 5, 0, 0],
    ],
  );
  // Experience comes from every game: it does not decide the ranking of one game.
  const uno = rankLeaderboard(
    [
      player('moi', { uno: { played: 1, won: 1 } }, {}, 10),
      player('lea', { uno: { played: 1, won: 1 } }, {}, 99),
    ],
    'week',
    'uno',
  );
  assert.deepEqual(
    uno.map((l) => [l.player.user_id, l.place]),
    [
      ['moi', 1],
      ['lea', 1],
    ],
  );
});

test('last week’s podium wins a chest, a grand one for the first, never alone', () => {
  const me = (lastWeek: LeaderboardPlayer['lastWeek'], lastWeekXp = 0) =>
    player('moi', {}, lastWeek, 0, lastWeekXp);
  const friends = [
    player('lea', {}, { uno: { played: 3, won: 2 } }),
    player('tom', {}, { poker: { played: 2, won: 1 } }, 0, 200),
    player('zoe', {}, { yams: { played: 1, won: 0 } }, 0, 50),
  ];
  assert.equal(leaderboardChest([me({ uno: { played: 4, won: 3 } }), ...friends]), 'grand');
  assert.equal(leaderboardChest([me({ uno: { played: 2, won: 1 } }, 500), ...friends]), 'normal');
  // Same points and wins as Tom, less experience: third place.
  assert.equal(leaderboardChest([me({ uno: { played: 2, won: 1 } }, 100), ...friends]), 'normal');
  assert.equal(leaderboardChest([me({ uno: { played: 1, won: 0 } }), ...friends]), null);
  // Experience alone, without an online game, wins nothing.
  assert.equal(leaderboardChest([me({}, 5000), ...friends]), null);
  // Nobody wins alone: one player of last week is not a podium.
  assert.equal(leaderboardChest([me({ uno: { played: 5, won: 5 } }), player('lea', {}, {})]), null);
  // Equal first places both get the grand chest.
  assert.equal(
    leaderboardChest([
      me({ uno: { played: 1, won: 1 } }),
      player('lea', {}, { yams: { played: 1, won: 1 } }),
    ]),
    'grand',
  );
  // This week's games do not count for last week's chest.
  assert.equal(leaderboardChest([player('moi', { uno: { played: 9, won: 9 } }), ...friends]), null);
});

test('the week ends on Monday at midnight in Paris, summer and winter time', () => {
  // Thursday 8 October 2026, noon in Paris (summer time, UTC+2).
  assert.equal(weekEndsAt(Date.UTC(2026, 9, 8, 10)), Date.UTC(2026, 9, 11, 22));
  // Sunday 1 November 2026, 23:30 in Paris (winter time, UTC+1).
  assert.equal(weekEndsAt(Date.UTC(2026, 10, 1, 22, 30)), Date.UTC(2026, 10, 1, 23));
  // Monday 2 November 2026, 00:00 in Paris: a new week has just started.
  assert.equal(weekEndsAt(Date.UTC(2026, 10, 1, 23)), Date.UTC(2026, 10, 8, 23));
});
