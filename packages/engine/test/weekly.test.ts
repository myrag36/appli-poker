import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONLINE_GAMES,
  type WeeklyEntrant,
  bracketSize,
  duelWinner,
  findReward,
  isUnlocked,
  lastWeeklyFriday,
  nextReward,
  nextWeeklyFriday,
  parisTime,
  seedOrder,
  seedWeeklyBracket,
  setWeeklyWinner,
  settleWeekly,
  weeklyChampion,
  weeklyGameFor,
  weeklyGames,
  weeklyKnockedOut,
  weeklyMatchOf,
  weeklyMatchesToOpen,
  weeklyRoundName,
  weeklyStartsAt,
  matchKey,
} from '../src/index.ts';

const first = () => 0;
let n = 0;
const botId = () => `bot-${++n}`;
const people = (count: number): WeeklyEntrant[] =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, bot: false }));

test('the tournament starts on Friday at 21:00 Paris time, summer and winter alike', () => {
  // Summer time (UTC+2): 19:00 UTC.
  assert.equal(new Date(weeklyStartsAt('2026-10-16')).toISOString(), '2026-10-16T19:00:00.000Z');
  // Winter time (UTC+1), after the change of 25 October 2026: 20:00 UTC.
  assert.equal(new Date(weeklyStartsAt('2026-10-30')).toISOString(), '2026-10-30T20:00:00.000Z');
  assert.equal(new Date(parisTime('2027-03-26', 21)).toISOString(), '2027-03-26T20:00:00.000Z');
  assert.equal(new Date(parisTime('2027-04-02', 21)).toISOString(), '2027-04-02T19:00:00.000Z');
});

test('the next Friday is this week until 21:00, then the next one', () => {
  // Saturday 10 October 2026.
  assert.equal(nextWeeklyFriday(Date.parse('2026-10-10T12:00:00Z')), '2026-10-16');
  // Monday, Thursday night.
  assert.equal(nextWeeklyFriday(Date.parse('2026-10-12T08:00:00Z')), '2026-10-16');
  assert.equal(nextWeeklyFriday(Date.parse('2026-10-15T23:30:00Z')), '2026-10-16');
  // Friday 20:59 then 21:00 Paris.
  assert.equal(nextWeeklyFriday(Date.parse('2026-10-16T18:59:00Z')), '2026-10-16');
  assert.equal(nextWeeklyFriday(Date.parse('2026-10-16T19:00:00Z')), '2026-10-23');
  assert.equal(lastWeeklyFriday(Date.parse('2026-10-16T19:00:00Z')), '2026-10-16');
  // Across the change to winter time.
  assert.equal(nextWeeklyFriday(Date.parse('2026-10-25T12:00:00Z')), '2026-10-30');
  assert.equal(nextWeeklyFriday(Date.parse('2026-10-30T19:30:00Z')), '2026-10-30');
});

test('the games of the rotation come from the online registry and seat two players', () => {
  const games = weeklyGames();
  assert.ok(games.length >= 3);
  for (const g of games) {
    const def = ONLINE_GAMES[g];
    assert.ok(def.minPlayers <= 2 && def.maxPlayers >= 2 && (def.fillTo ?? 0) <= 2, g);
  }
  // Games played by four (Belote, Tarot) or needing robots beyond two (Président) are left out.
  for (const g of ['belote', 'tarot', 'president']) assert.ok(!games.includes(g as never), g);
  assert.ok(games.includes('puissance4'));
});

test('one game per week, each in turn', () => {
  const games = weeklyGames();
  const seen = new Set<string>();
  let friday = '2026-10-16';
  for (let i = 0; i < games.length; i++) {
    seen.add(weeklyGameFor(friday));
    const d = new Date(`${friday}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    friday = d.toISOString().slice(0, 10);
  }
  assert.equal(seen.size, games.length);
  assert.equal(weeklyGameFor('2026-10-16'), weeklyGameFor('2026-10-16'));
  assert.equal(weeklyGameFor('2026-10-16', ['uno']), 'uno');
});

test('bracket sizes and seeding', () => {
  assert.equal(bracketSize(0), 2);
  assert.equal(bracketSize(1), 2);
  assert.equal(bracketSize(2), 2);
  assert.equal(bracketSize(3), 4);
  assert.equal(bracketSize(5), 8);
  assert.equal(bracketSize(32), 32);
  assert.deepEqual(seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test('robots fill the free seats and always face people in the first round', () => {
  for (const count of [1, 3, 5, 6, 7, 9, 13, 17]) {
    const bracket = seedWeeklyBracket(people(count), first, botId);
    const size = bracketSize(count);
    assert.equal(bracket.rounds[0].length, size / 2);
    assert.equal(bracket.rounds.length, Math.log2(size));
    const seated = bracket.rounds[0].flatMap((m) => [m.a!, m.b!]);
    assert.equal(seated.filter((e) => !e.bot).length, count);
    assert.equal(seated.filter((e) => e.bot).length, size - count);
    assert.equal(new Set(seated.map((e) => e.id)).size, size);
    for (const m of bracket.rounds[0]) assert.ok(!(m.a!.bot && m.b!.bot), `${count}: robots face each other`);
    // Every first-round match has a person: all of them get a table.
    assert.equal(weeklyMatchesToOpen(bracket).length, size / 2);
  }
});

test('a single player meets a robot in the final', () => {
  const bracket = seedWeeklyBracket(people(1), first, botId);
  assert.equal(bracket.rounds.length, 1);
  const final = bracket.rounds[0][0];
  assert.ok(final.a!.bot !== final.b!.bot);
});

test('winners move on, the next table opens once both are known, the champion is found', () => {
  let bracket = seedWeeklyBracket(people(4), first, botId);
  const [m0, m1] = bracket.rounds[0];
  bracket = settleWeekly(setWeeklyWinner(bracket, matchKey(m0), m0.a!.id, 'game'), first);
  assert.equal(bracket.rounds[1][0].a?.id, m0.a!.id);
  assert.equal(bracket.rounds[1][0].b, null);
  // The final waits for the other semi-final.
  assert.deepEqual(
    weeklyMatchesToOpen(bracket).map((m) => matchKey(m)),
    ['0-1'],
  );
  assert.equal(weeklyMatchOf(bracket, m0.a!.id)?.round, 1);
  assert.ok(weeklyKnockedOut(bracket, m0.b!.id));
  assert.equal(weeklyMatchOf(bracket, m0.b!.id), null);

  bracket = settleWeekly(setWeeklyWinner(bracket, matchKey(m1), m1.b!.id, 'timeout'), first);
  assert.deepEqual(
    weeklyMatchesToOpen(bracket).map((m) => matchKey(m)),
    ['1-0'],
  );
  assert.equal(weeklyChampion(bracket), null);
  bracket = settleWeekly(setWeeklyWinner(bracket, '1-0', m1.b!.id, 'game'), first);
  assert.equal(weeklyChampion(bracket)?.id, m1.b!.id);
  assert.equal(weeklyMatchOf(bracket, m1.b!.id), null);
  assert.deepEqual(weeklyMatchesToOpen(bracket), []);
});

test('a result is recorded once, and only for a player of the match', () => {
  let bracket = seedWeeklyBracket(people(2), first, botId);
  const m = bracket.rounds[0][0];
  bracket = setWeeklyWinner(bracket, '0-0', m.a!.id, 'game');
  const again = setWeeklyWinner(bracket, '0-0', m.b!.id, 'game');
  assert.equal(again.rounds[0][0].winner, m.a!.id);
  assert.throws(() => setWeeklyWinner(seedWeeklyBracket(people(2), first, botId), '0-0', 'x', 'game'));
  assert.throws(() => setWeeklyWinner(bracket, '4-0', m.a!.id, 'game'));
});

test('two robots meeting are decided by a draw, without a table', () => {
  // 3 people: seeds 1-3 people, seed 4 a robot. If the robot wins its first match and so does...
  let bracket = seedWeeklyBracket(people(5), first, botId);
  // Make every robot win its first-round match.
  for (const m of bracket.rounds[0]) {
    const bot = m.a!.bot ? m.a! : m.b!.bot ? m.b! : null;
    if (bot) bracket = setWeeklyWinner(bracket, matchKey(m), bot.id, 'game');
  }
  bracket = settleWeekly(bracket, first);
  const robotsMatch = bracket.rounds[1].find((m) => m.a?.bot && m.b?.bot);
  assert.ok(robotsMatch);
  assert.equal(robotsMatch.by, 'draw');
  assert.ok(robotsMatch.winner);
  assert.ok(!weeklyMatchesToOpen(bracket).some((m) => m.a?.bot && m.b?.bot));
});

test('a tie at the table is broken by the draw given', () => {
  assert.equal(duelWinner([0], 1), 0);
  assert.equal(duelWinner([1], 0), 1);
  assert.equal(duelWinner([0, 1], 1), 1);
  assert.equal(duelWinner([], 0), 0);
});

test('round names', () => {
  assert.equal(weeklyRoundName(2, 3), 'Finale');
  assert.equal(weeklyRoundName(1, 3), 'Demi-finales');
  assert.equal(weeklyRoundName(0, 3), 'Quarts de finale');
  assert.equal(weeklyRoundName(0, 5), 'Seizièmes de finale');
});

test('the champion title is a trophy: never unlocked by level nor sold', () => {
  const title = findReward('title', 'vendredi');
  assert.ok(title?.trophy);
  assert.equal(title.price, undefined);
  assert.ok(!isUnlocked('title', 'vendredi', 50));
  assert.ok(isUnlocked('title', 'vendredi', 1, ['title:vendredi']));
  for (let level = 0; level < 50; level++) assert.notEqual(nextReward(level)?.id, 'vendredi');
});
