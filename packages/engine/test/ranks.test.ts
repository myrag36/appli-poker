import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMOTE_RP,
  LEGEND_TOP,
  MASTER_POINTS,
  ONLINE_GAMES,
  PLACEMENT_CAP,
  PLACEMENT_GAMES,
  QUICK_GAMES,
  RANKED_EXCLUDED,
  RANKED_GAMES,
  RANKED_GAME_IDS,
  RANK_TIERS,
  REWARDS,
  RP_MIN,
  SEASON_REWARDS,
  type RankedState,
  applyRanked,
  divisionFloor,
  divisionProgress,
  findReward,
  isRankedGame,
  isUnlocked,
  legendIds,
  mainRank,
  newSeasonState,
  nextReward,
  placementState,
  previousSeasonKey,
  rankName,
  rankOf,
  rankedDeltas,
  rankedWindow,
  rewardsAtLevel,
  rpLabel,
  seasonBestTier,
  seasonKey,
  seasonOfKey,
  seasonReward,
  softReset,
  tierFloor,
  unlockText,
} from '../src/index.ts';

const placed = (points: number, over: Partial<RankedState> = {}): RankedState => ({
  points,
  games: 10,
  wins: 5,
  shield: 0,
  placement: 0,
  peak: points,
  ...over,
});

test('points map to tiers, divisions III to I, then Maître', () => {
  assert.deepEqual(rankOf(0), { tier: 'bronze', division: 3, rp: 0 });
  assert.deepEqual(rankOf(99), { tier: 'bronze', division: 3, rp: 99 });
  assert.deepEqual(rankOf(100), { tier: 'bronze', division: 2, rp: 0 });
  assert.deepEqual(rankOf(299), { tier: 'bronze', division: 1, rp: 99 });
  assert.deepEqual(rankOf(300), { tier: 'argent', division: 3, rp: 0 });
  assert.deepEqual(rankOf(740), { tier: 'or', division: 2, rp: 40 });
  assert.deepEqual(rankOf(1499), { tier: 'diamant', division: 1, rp: 99 });
  assert.deepEqual(rankOf(1500), { tier: 'maitre', division: null, rp: 0 });
  assert.deepEqual(rankOf(1730), { tier: 'maitre', division: null, rp: 230 });
  assert.deepEqual(rankOf(1730, true), { tier: 'legende', division: null, rp: 230 });
  assert.deepEqual(rankOf(-5), { tier: 'bronze', division: 3, rp: 0 });
  assert.equal(rankName(rankOf(740)), 'Or II');
  assert.equal(rankName(rankOf(1200)), 'Diamant III');
  assert.equal(rankName(rankOf(1600)), 'Maître');
  assert.equal(rankName(rankOf(1600, true)), 'Légende');
  assert.equal(RANK_TIERS.length, 7);
});

test('floors of divisions and tiers', () => {
  assert.equal(divisionFloor(740), 700);
  assert.equal(tierFloor(740), 600);
  assert.equal(divisionFloor(1800), MASTER_POINTS);
  assert.equal(tierFloor(1800), MASTER_POINTS);
  assert.equal(divisionProgress(740), 0.4);
  assert.equal(divisionProgress(1650), 0.5);
});

test('ranked games: one table size each, chance-only and bank games left out', () => {
  assert.ok(!isRankedGame('bataille'));
  assert.ok(!isRankedGame('blackjack'));
  assert.ok(isRankedGame('poker'));
  assert.ok(isRankedGame('echecs'));
  assert.ok(!isRankedGame('toString'));
  assert.deepEqual(Object.keys(RANKED_EXCLUDED).sort(), ['bataille', 'blackjack']);
  assert.equal(RANKED_GAME_IDS.length + Object.keys(RANKED_EXCLUDED).length, Object.keys(QUICK_GAMES).length);
  for (const g of RANKED_GAME_IDS) {
    const quick = QUICK_GAMES[g];
    assert.ok(quick.sizes.includes(RANKED_GAMES[g].size), g);
    if (g !== 'poker') {
      const def = ONLINE_GAMES[g];
      assert.ok(RANKED_GAMES[g].size >= def.minPlayers && RANKED_GAMES[g].size <= def.maxPlayers, g);
      assert.equal(RANKED_GAMES[g].variant, '');
    }
  }
  assert.equal(RANKED_GAMES.poker.variant, 'holdem');
});

test('RP: equals share 20, beating a stronger player pays more, a lone loser always loses', () => {
  const even = rankedDeltas([
    { id: 'a', points: 700, place: 1, placing: false },
    { id: 'b', points: 700, place: 2, placing: false },
  ]);
  assert.deepEqual(even, { a: 20, b: -20 });
  const upset = rankedDeltas([
    { id: 'a', points: 600, place: 1, placing: false },
    { id: 'b', points: 800, place: 2, placing: false },
  ]);
  assert.ok(upset.a > 20 && upset.b < -20);
  const expected = rankedDeltas([
    { id: 'a', points: 1400, place: 1, placing: false },
    { id: 'b', points: 300, place: 2, placing: false },
  ]);
  assert.equal(expected.a, RP_MIN);
  assert.equal(expected.b, -RP_MIN);
  // Placement moves twice as fast.
  const placing = rankedDeltas([
    { id: 'a', points: 300, place: 1, placing: true },
    { id: 'b', points: 300, place: 2, placing: false },
  ]);
  assert.equal(placing.a, 40);
  assert.equal(placing.b, -20);
  // A team game: both winners share the first place.
  const belote = rankedDeltas([
    { id: 'a', points: 500, place: 1, placing: false },
    { id: 'b', points: 500, place: 1, placing: false },
    { id: 'c', points: 500, place: 3, placing: false },
    { id: 'd', points: 500, place: 3, placing: false },
  ]);
  assert.ok(belote.a > 0 && belote.b === belote.a && belote.c < 0 && belote.c === -belote.a);
  assert.deepEqual(rankedDeltas([{ id: 'a', points: 0, place: 1, placing: false }]), {});
});

test('reaching 100 RP promotes and raises the shield', () => {
  const out = applyRanked(placed(790, { peak: 790 }), 20, true);
  assert.equal(out.state.points, 810);
  assert.deepEqual(out.promoted, { tier: 'or', division: 1, rp: 10 });
  assert.equal(out.state.shield, 1);
  assert.equal(out.state.peak, 810);
  assert.equal(out.state.games, 11);
  assert.equal(out.state.wins, 6);
  // Into a new tier.
  const tier = applyRanked(placed(890), 20, true);
  assert.deepEqual(tier.promoted, { tier: 'platine', division: 3, rp: 10 });
  // Into Maître.
  assert.equal(applyRanked(placed(1490), 20, true).promoted?.tier, 'maitre');
});

test('the shield saves the game right after a promotion, then it is gone', () => {
  const promoted = applyRanked(placed(790), 20, true).state;
  const shielded = applyRanked(promoted, -20, false);
  assert.equal(shielded.state.points, 800);
  assert.equal(shielded.saved, 'shield');
  assert.equal(shielded.demoted, null);
  assert.equal(shielded.state.shield, 0);
  const next = applyRanked(shielded.state, -20, false);
  assert.equal(next.demoted?.tier, 'or');
  assert.equal(next.state.points, 780);
  // A win also uses the shield up.
  assert.equal(applyRanked(promoted, 20, true).state.shield, 0);
});

test('a loss never drops out of a tier at once: it stops at 0 RP first', () => {
  const first = applyRanked(placed(610), -20, false);
  assert.equal(first.state.points, 600);
  assert.equal(first.saved, 'floor');
  assert.equal(first.demoted, null);
  const second = applyRanked(first.state, -20, false);
  assert.deepEqual(second.demoted, { tier: 'argent', division: 1, rp: 80 });
  // A big loss lands at 75 RP in the division below, never lower.
  assert.equal(applyRanked(placed(600), -40, false).state.points, 600 - 100 + DEMOTE_RP);
  assert.equal(second.saved, null);
  // Inside a tier, a division is lost normally (landing at 75 RP at most).
  const inside = applyRanked(placed(705), -20, false);
  assert.deepEqual(inside.demoted, { tier: 'or', division: 3, rp: 85 });
  const far = applyRanked(placed(700), -40, false);
  assert.equal(far.state.points, 675);
  // Maître: down to 0 RP first, then Diamant I.
  assert.equal(applyRanked(placed(1510), -20, false).state.points, 1500);
  assert.equal(applyRanked(placed(1500), -20, false).demoted?.tier, 'diamant');
});

test('Bronze loses half, and nobody goes below 0', () => {
  assert.equal(applyRanked(placed(150), -20, false).state.points, 140);
  assert.equal(applyRanked(placed(150), -1, false).state.points, 149);
  assert.equal(applyRanked(placed(0), -20, false).state.points, 0);
  assert.equal(applyRanked(placed(0), -20, false).delta, 0);
  assert.equal(applyRanked(placed(400), -20, false).state.points, 380);
});

test('placement: hidden for five games, starting from the casual rating, capped at Platine III', () => {
  let s = placementState(1000);
  assert.equal(s.points, 300);
  assert.equal(s.placement, PLACEMENT_GAMES);
  assert.equal(placementState(600).points, 0);
  assert.equal(placementState(2000).points, 600);
  for (let i = 0; i < PLACEMENT_GAMES; i++) {
    const out = applyRanked(s, 150, true);
    assert.equal(out.promoted, null);
    assert.equal(out.placed, i === PLACEMENT_GAMES - 1);
    s = out.state;
  }
  assert.equal(s.points, PLACEMENT_CAP);
  assert.equal(s.placement, 0);
  assert.equal(s.peak, PLACEMENT_CAP);
  assert.equal(s.games, PLACEMENT_GAMES);
});

test('a new season starts one tier lower; placement again only if never placed', () => {
  assert.equal(softReset(740), 300);
  assert.equal(softReset(250), 0);
  assert.equal(softReset(1800), 1200);
  assert.equal(softReset(1400), 900);
  const next = newSeasonState(placed(740), 1000);
  assert.deepEqual(next, { points: 300, games: 0, wins: 0, shield: 0, placement: 0, peak: 300 });
  assert.equal(newSeasonState(null, 1100).placement, PLACEMENT_GAMES);
  assert.equal(newSeasonState(null, 1100).points, 400);
  assert.equal(newSeasonState(placed(740, { placement: 2 }), 1000).placement, PLACEMENT_GAMES);
});

test('season keys follow the Paris month', () => {
  assert.equal(seasonKey('2026-10-31'), '2026-10');
  assert.equal(previousSeasonKey('2026-10'), '2026-09');
  assert.equal(previousSeasonKey('2027-01'), '2026-12');
  assert.equal(seasonOfKey('2026-11').name, 'Automne');
});

test('the matchmaking window widens slowly and stays within two tiers', () => {
  assert.equal(rankedWindow(0), 150);
  assert.equal(rankedWindow(14_999), 150);
  assert.equal(rankedWindow(15_000), 200);
  assert.equal(rankedWindow(60_000), 350);
  assert.equal(rankedWindow(3_600_000), 600);
});

test('Légende: the best Maître players of a game, placed only', () => {
  const rows = Array.from({ length: LEGEND_TOP + 3 }, (_, i) => ({
    user_id: `u${String(i).padStart(2, '0')}`,
    points: MASTER_POINTS + i * 10,
    placement: 0,
  }));
  rows.push({ user_id: 'diamond', points: 1450, placement: 0 });
  const legends = legendIds(rows);
  assert.equal(legends.size, LEGEND_TOP);
  assert.ok(legends.has('u12'));
  assert.ok(!legends.has('u00'));
  assert.ok(!legends.has('diamond'));
  assert.equal(legendIds([{ user_id: 'x', points: 1500, placement: 1 }]).size, 0);
});

test('the main rank is the best rank placed', () => {
  assert.equal(mainRank([]), null);
  assert.equal(mainRank([{ game: 'uno', points: 900, placement: 2 }]), null);
  const best = mainRank([
    { game: 'uno', points: 900, placement: 0 },
    { game: 'echecs', points: 1200, placement: 0 },
    { game: 'dames', points: 1400, placement: 3 },
  ]);
  assert.equal(best?.game, 'echecs');
  assert.equal(
    mainRank([
      { game: 'uno', points: 1900, placement: 0 },
      { game: 'echecs', points: 1600, placement: 0, legend: true },
    ])?.game,
    'echecs',
  );
});

test('season rewards: by the best tier reached, with a seasonal title', () => {
  assert.equal(seasonBestTier([]), null);
  assert.equal(seasonBestTier([{ game: 'uno', peak: 900, placement: 3 }]), null);
  assert.equal(
    seasonBestTier([
      { game: 'uno', peak: 650, placement: 0 },
      { game: 'echecs', peak: 320, placement: 0 },
    ]),
    'or',
  );
  assert.equal(seasonBestTier([{ game: 'uno', peak: 1700, placement: 0 }], new Set(['uno'])), 'legende');
  const gold = seasonReward('2026-11', 'or');
  assert.equal(gold.coins, SEASON_REWARDS.or.coins);
  assert.equal(gold.chest, 'normal');
  assert.deepEqual(gold.items, ['title:classe-or-11', 'frame:classe-or']);
  assert.equal(findReward('title', 'classe-or-11')?.name, 'Or — Saison Automne');
  assert.deepEqual(seasonReward('2026-01', 'bronze').items, ['title:classe-bronze-1']);
  assert.equal(seasonReward('2026-01', 'legende').items.length, 3);
  // Every item given exists, as a trophy nobody can buy or reach by level.
  for (const tier of RANK_TIERS) {
    for (const key of seasonReward('2026-05', tier.id).items) {
      const [kind, id] = key.split(':') as ['title', string];
      const reward = findReward(kind, id);
      assert.ok(reward?.trophy && reward.rank === tier.id, key);
      assert.ok(!isUnlocked(kind, id, 50, []));
      assert.ok(isUnlocked(kind, id, 1, [key]));
    }
  }
  assert.ok(!rewardsAtLevel(1).some((r) => r.rank));
  assert.ok(!nextReward(0)?.rank);
  assert.equal(REWARDS.filter((r) => r.rank && r.kind === 'title').length, 7 * 12);
  assert.deepEqual(unlockText(findReward('frame', 'classe-or')!), {
    text: 'Atteins le rang {name} en tables classées',
    vars: { name: 'Or' },
  });
});

test('RP labels', () => {
  assert.equal(rpLabel(18), '+18 RP');
  assert.equal(rpLabel(-12), '−12 RP');
  assert.equal(rpLabel(0), '±0 RP');
});
