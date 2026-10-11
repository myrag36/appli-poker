import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameError } from '../poker/logic.ts';
import {
  MASTER_POINTS,
  PLACEMENT_GAMES,
  RANKED_GAMES,
  RANKED_GAME_IDS,
  RANKED_LEVEL,
  xpForLevel,
} from '../_shared/engine/index.ts';
import {
  type QueueRow,
  fillGroup,
  newQueueRow,
  pairQueue,
  queueKey,
  queueStatus,
  quickGameRoom,
  quickPokerRoom,
  searchRequest,
} from './rapide.ts';
import {
  type RankedRow,
  type RankedStart,
  boardLines,
  endPlacements,
  forfeitPlan,
  maitreGames,
  myRanks,
  rankCode,
  rankedStarts,
  rankedUpdates,
  rewardFor,
  seasonsToClaim,
} from './classees.ts';
import { forfeitSeat, playGameMove, playGameTimeout, startGame } from './logic.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const LEVEL_10 = xpForLevel(RANKED_LEVEL);

function row(id: string, over: Partial<QueueRow> = {}): QueueRow {
  return {
    user_id: id,
    game: 'uno',
    size: 2,
    variant: '',
    ranked: true,
    rating: 700,
    level: 12,
    name: id,
    avatar: '🦊',
    avatar_color: '#e76f51',
    status: 'waiting',
    joined_at: iso(1_000),
    last_seen: iso(500),
    room_id: null,
    room_code: null,
    joins: 1,
    joins_since: iso(1_000),
    ...over,
  };
}

function rank(
  user: string,
  game: string,
  season: string,
  points: number,
  over: Partial<RankedRow> = {},
): RankedRow {
  return {
    user_id: user,
    game,
    season,
    points,
    games: 20,
    wins: 10,
    shield: 0,
    placement: 0,
    peak: points,
    ...over,
  };
}

const look = { name: 'Léa', avatar: '🦄', avatar_color: '#8e7dbe' };

test('a ranked search needs level 10 and a ranked game, and gets its standard table', () => {
  assert.throws(() => searchRequest({ game: 'uno', ranked: true }, xpForLevel(9)), /niveau 10/);
  assert.throws(() => searchRequest({ game: 'blackjack', ranked: true }, LEVEL_10), /partie classée/);
  assert.equal(searchRequest({ game: 'bataille', ranked: true }, LEVEL_10).size, 2);
  assert.deepEqual(searchRequest({ game: 'uno', ranked: true, size: 4 }, LEVEL_10), {
    ranked: true,
    game: 'uno',
    ...RANKED_GAMES.uno,
  });
  assert.deepEqual(searchRequest({ game: 'poker', ranked: true, size: 6, variant: 'omaha' }, LEVEL_10), {
    ranked: true,
    game: 'poker',
    size: 2,
    variant: 'holdem',
  });
  // A normal search stays as it was, at any level.
  assert.equal(searchRequest({ game: 'uno', size: 4 }, 0).ranked, false);
  const r = newQueueRow('me', { game: 'echecs', ranked: true }, look, 640, LEVEL_10, null, NOW);
  assert.deepEqual([r.ranked, r.size, r.rating], [true, 2, 640]);
});

test('ranked and normal searches never meet', () => {
  assert.notEqual(queueKey(row('a')), queueKey(row('a', { ranked: false })));
  const tables = pairQueue([row('a'), row('b', { ranked: false, rating: 1000 })], [], NOW);
  assert.deepEqual(tables, []);
  assert.deepEqual(pairQueue([row('a'), row('b', { rating: 760 })], [], NOW), [['a', 'b']]);
});

test('ranked players are seated with close ranks only, even after a long wait', () => {
  // 300 points apart: one tier.
  const far = [row('a', { rating: 300 }), row('b', { rating: 600 })];
  assert.deepEqual(pairQueue(far, [], NOW), []);
  const later = far.map((r) => ({ ...r, joined_at: iso(75_000), last_seen: iso(1_000) }));
  assert.deepEqual(pairQueue(later, [], NOW), [['a', 'b']]);
  // Never more than two tiers, however long the wait.
  const tooFar = [row('a', { rating: 0, joined_at: iso(600_000) }), row('b', { rating: 1400 })];
  assert.deepEqual(pairQueue(tooFar, [], NOW), []);
});

test('no robots at a ranked table', () => {
  const me = row('me', { joined_at: iso(120_000) });
  assert.throws(() => fillGroup(me, [me], [], NOW), /Pas de robots/);
  const status = queueStatus(me, [me], [], NOW);
  assert.equal(status.canFill, false);
  assert.equal(status.ranked, true);
  assert.equal(queueStatus(row('me', { ranked: false, joined_at: iso(120_000) }), [], [], NOW).canFill, true);
});

test('ranked quick tables are marked ranked', () => {
  const group = [row('a'), row('b')];
  assert.equal(quickGameRoom('r1', 'ABC123', group).room.ranked, true);
  assert.equal(quickGameRoom('r1', 'ABC123', [row('a', { ranked: false })]).room.ranked, false);
  const poker = quickPokerRoom('r2', 'ABC124', [row('a', { game: 'poker', variant: 'holdem' })]);
  assert.equal(poker.room.ranked, true);
});

test('the start of a table: this season, else one tier lower than last season, else placement', () => {
  const rows = [
    rank('a', 'uno', '2026-10', 740),
    rank('b', 'uno', '2026-09', 740),
    rank('b', 'uno', '2026-07', 1600),
    rank('c', 'uno', '2026-09', 900, { placement: 2 }),
  ];
  const starts = rankedStarts(['a', 'b', 'c', 'd'], rows, '2026-10', { d: 1100 });
  assert.deepEqual(starts.get('a'), {
    state: { points: 740, games: 20, wins: 10, shield: 0, placement: 0, peak: 740 },
    games: 20,
  });
  assert.equal(starts.get('b')!.state.points, 300);
  assert.equal(starts.get('b')!.games, -1);
  assert.equal(starts.get('c')!.state.placement, PLACEMENT_GAMES);
  assert.equal(starts.get('c')!.state.points, 300);
  assert.equal(starts.get('d')!.state.points, 400);
  // A future season's row (clock skew) is ignored.
  assert.equal(rankedStarts(['a'], [rank('a', 'uno', '2026-11', 1500)], '2026-10', {}).get('a')!.games, -1);
});

test('a finished ranked table: the winner climbs, the loser drops, with the change to save', () => {
  const starts = new Map<string, RankedStart>([
    ['a', { state: { points: 790, games: 20, wins: 10, shield: 0, placement: 0, peak: 790 }, games: 20 }],
    ['b', { state: { points: 790, games: 4, wins: 2, shield: 0, placement: 0, peak: 790 }, games: 4 }],
  ]);
  const updates = rankedUpdates(
    [
      { userId: 'a', place: 1 },
      { userId: 'b', place: 2 },
    ],
    starts,
  );
  const a = updates.find((u) => u.user_id === 'a')!;
  const b = updates.find((u) => u.user_id === 'b')!;
  assert.equal(a.games, 20);
  assert.equal(a.state.points, 810);
  assert.equal(a.state.wins, 11);
  assert.equal(a.change.promoted, 'or-1');
  assert.equal(a.change.delta, 20);
  assert.equal(b.state.points, 770);
  assert.equal(b.change.delta, -20);
  assert.equal(b.state.wins, 2);
  assert.equal(b.change.forfeit, false);
  // Robots are not in the placements; a lone person changes nothing.
  assert.deepEqual(rankedUpdates([{ userId: 'a', place: 1 }], starts), []);
  // A draw is no win.
  const draw = rankedUpdates(
    [
      { userId: 'a', place: 1 },
      { userId: 'b', place: 1 },
    ],
    starts,
  );
  assert.deepEqual(
    draw.map((u) => [u.change.delta, u.state.wins]),
    [
      [0, 10],
      [0, 2],
    ],
  );
  assert.equal(rankCode(null), null);
  assert.equal(rankCode({ tier: 'maitre', division: null, rp: 3 }), 'maitre');
});

test('abandoning a ranked table is a loss; the last opponent wins at once', () => {
  assert.deepEqual(forfeitPlan('a', ['a', 'b'], new Set()), {
    placements: [
      { userId: 'a', place: 2 },
      { userId: 'b', place: 1 },
    ],
    only: new Set(['a', 'b']),
  });
  const four = forfeitPlan('a', ['a', 'b', 'c', 'd'], new Set());
  assert.deepEqual([...four!.only], ['a']);
  assert.equal(four!.placements.length, 4);
  // After someone left, the next one to leave loses against those still there.
  assert.deepEqual(forfeitPlan('b', ['a', 'b', 'c'], new Set(['a']))!.placements.length, 2);
  // Already rated (the game was decided): leaving costs nothing.
  assert.equal(forfeitPlan('b', ['a', 'b'], new Set(['a', 'b'])), null);
  assert.equal(forfeitPlan('z', ['a', 'b'], new Set()), null);
  // At the end, those who left are not rated twice.
  assert.deepEqual(
    endPlacements(
      [
        { userId: 'b', place: 1 },
        { userId: 'c', place: 2 },
      ],
      new Set(['a']),
    ).length,
    2,
  );
  assert.deepEqual(endPlacements([{ userId: 'a', place: 1 }], new Set(['a'])), []);
  const starts = new Map<string, RankedStart>([
    ['a', { state: { points: 500, games: 9, wins: 4, shield: 0, placement: 0, peak: 500 }, games: 9 }],
    ['b', { state: { points: 500, games: 9, wins: 4, shield: 0, placement: 0, peak: 500 }, games: 9 }],
    ['c', { state: { points: 500, games: 9, wins: 4, shield: 0, placement: 0, peak: 500 }, games: 9 }],
  ]);
  const plan = forfeitPlan('a', ['a', 'b', 'c'], new Set())!;
  const updates = rankedUpdates(plan.placements, starts, { only: plan.only, forfeit: 'a' });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].change.forfeit, true);
  assert.ok(updates[0].change.delta < 0);
});

test('an abandoned seat is played by a robot, and its player cannot move any more', () => {
  const players = [
    { user_id: 'a', name: 'A', seat: 0, is_bot: false },
    { user_id: 'b', name: 'B', seat: 1, is_bot: false },
  ];
  const room = {
    id: 'r',
    code: 'C',
    game: 'puissance4' as const,
    host_id: 'a',
    options: { rounds: 1 },
    status: 'lobby' as const,
    version: 0,
  };
  let n = 0;
  const { snapshot } = startGame(
    room,
    players,
    'a',
    () => `bot${n++}`,
    () => 0,
    NOW,
  );
  const left = forfeitSeat(snapshot.secret, 'a', NOW);
  assert.deepEqual(left.secret.seats[0], { id: 'a', name: 'A', bot: true, left: true });
  assert.equal(left.privates.a, undefined);
  assert.throws(() => forfeitSeat(left.secret, 'a', NOW), /déjà quitté/);
  assert.throws(() => playGameMove(left.secret, 'a', { column: 0 }, () => 0, NOW), /quitté/);
  assert.throws(() => forfeitSeat(snapshot.secret, 'z', NOW), GameError);
  // The robot plays at robot speed.
  if (left.public.actors.includes('a')) {
    const next = playGameTimeout(left.secret, () => 0, left.secret.deadline!);
    assert.ok(!next.public.actors.includes('a') || next.public.over);
  }
});

test('my ranks: this season, or where the season will start for me', () => {
  const rows = [
    rank('me', 'uno', '2026-10', 820),
    rank('me', 'echecs', '2026-09', 1600),
    rank('me', 'dames', '2026-10', 300, { placement: 3 }),
  ];
  const ranks = myRanks(rows, '2026-10', { tarot: 1300 }, new Set(['uno']));
  assert.equal(ranks.length, RANKED_GAME_IDS.length);
  const uno = ranks.find((r) => r.game === 'uno')!;
  assert.deepEqual([uno.points, uno.legend, uno.fresh], [820, true, false]);
  const echecs = ranks.find((r) => r.game === 'echecs')!;
  assert.deepEqual([echecs.points, echecs.fresh, echecs.placement], [1200, true, 0]);
  assert.equal(ranks.find((r) => r.game === 'dames')!.placement, 3);
  const tarot = ranks.find((r) => r.game === 'tarot')!;
  assert.deepEqual([tarot.points, tarot.placement], [600, PLACEMENT_GAMES]);
});

test('season rewards: each finished season played, once, by the best tier', () => {
  const rows = [
    rank('me', 'uno', '2026-10', 820),
    rank('me', 'uno', '2026-09', 640, { peak: 910 }),
    rank('me', 'echecs', '2026-09', 1550),
    rank('me', 'dames', '2026-08', 300, { placement: 2 }),
    rank('me', 'uno', '2026-07', 100),
  ];
  assert.deepEqual(seasonsToClaim(rows, new Set(), '2026-10'), ['2026-09', '2026-07']);
  assert.deepEqual(seasonsToClaim(rows, new Set(['2026-09']), '2026-10'), ['2026-07']);
  assert.deepEqual(maitreGames(rows.filter((r) => r.season === '2026-09')), ['echecs']);
  assert.equal(rewardFor('2026-09', rows, new Set())!.tier, 'maitre');
  assert.equal(rewardFor('2026-09', rows, new Set(['echecs']))!.tier, 'legende');
  assert.equal(rewardFor('2026-07', rows, new Set())!.tier, 'bronze');
  assert.equal(rewardFor('2026-08', rows, new Set()), null);
  const gold = rewardFor('2026-09', [rank('me', 'uno', '2026-09', 640, { peak: 910 })], new Set())!;
  assert.equal(gold.tier, 'platine');
  assert.ok(gold.items.includes('title:classe-platine-9'));
});

test('the leaderboard: placed players, best first, ties share a place, Légende badges', () => {
  const rows = [
    rank('a', 'uno', '2026-10', 1700, { name: 'Ana' }),
    rank('b', 'uno', '2026-10', 900),
    rank('c', 'uno', '2026-10', 900),
    rank('d', 'uno', '2026-10', 1200, { placement: 2 }),
    rank('e', 'uno', '2026-10', 300),
  ];
  const lines = boardLines(rows);
  assert.deepEqual(
    lines.map((l) => [l.user_id, l.position]),
    [
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['e', 4],
    ],
  );
  assert.equal(lines[0].legend, true);
  assert.equal(lines[0].name, 'Ana');
  assert.equal(lines[1].name, 'Joueur');
  assert.equal(lines[1].legend, false);
  // The friends' board keeps the badges of the whole game.
  assert.equal(
    boardLines(
      [rows[0]],
      [
        rank('x', 'uno', '2026-10', MASTER_POINTS + 900),
        ...Array.from({ length: 10 }, (_, i) => rank(`t${i}`, 'uno', '2026-10', MASTER_POINTS + 800 - i)),
      ],
    )[0].legend,
    false,
  );
});
