import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLUB_COLORS,
  CLUB_EMOJIS,
  CLUB_SWITCH_COOLDOWN_MS,
  type ClubChallengeRow,
  canSwitchClub,
  challengeRefusal,
  cleanClubCode,
  cleanClubDescription,
  cleanClubLook,
  cleanClubName,
  clubCan,
  clubChest,
  clubPoints,
  duelScore,
  rankClubs,
} from '../src/index.ts';

test('club names are trimmed, single spaced and 3 to 24 characters long', () => {
  assert.deepEqual(cleanClubName('  Les   As\u0007 du Pique '), { name: 'Les As du Pique' });
  assert.ok('error' in cleanClubName('ab'));
  assert.ok('error' in cleanClubName('x'.repeat(25)));
  assert.deepEqual(cleanClubName('🔥'.repeat(24)), { name: '🔥'.repeat(24) });
  assert.ok('error' in cleanClubName(null));
});

test('descriptions are cut at 140 characters, badges and colors come from the lists', () => {
  assert.equal(Array.from(cleanClubDescription('é'.repeat(200))).length, 140);
  assert.equal(cleanClubDescription('  Tous\n\nles vendredis  '), 'Tous les vendredis');
  assert.deepEqual(cleanClubLook('🐉', '#e63946'), { emoji: '🐉', color: '#e63946' });
  assert.deepEqual(cleanClubLook('💩', 'red'), { emoji: CLUB_EMOJIS[0], color: CLUB_COLORS[5] });
});

test('club codes are 6 letters or digits, whatever the case or spaces', () => {
  assert.equal(cleanClubCode(' ab-c12 3'), 'ABC123');
  assert.equal(cleanClubCode('ABC12'), null);
  assert.equal(cleanClubCode(undefined), null);
});

test('permissions: owner above admins above members', () => {
  assert.ok(clubCan('member', 'invite'));
  assert.ok(clubCan('member', 'leave'));
  assert.ok(!clubCan('owner', 'leave'));
  assert.ok(clubCan('owner', 'leave', undefined, { alone: true }));
  for (const a of ['edit', 'newCode', 'challenge'] as const) {
    assert.ok(!clubCan('member', a));
    assert.ok(clubCan('admin', a));
    assert.ok(clubCan('owner', a));
  }
  assert.ok(clubCan('owner', 'kick', 'admin'));
  assert.ok(clubCan('owner', 'kick', 'member'));
  assert.ok(clubCan('admin', 'kick', 'member'));
  assert.ok(!clubCan('admin', 'kick', 'admin'));
  assert.ok(!clubCan('admin', 'kick', 'owner'));
  assert.ok(!clubCan('member', 'kick', 'member'));
  assert.ok(!clubCan('owner', 'kick'));
  assert.ok(clubCan('owner', 'promote', 'member'));
  assert.ok(!clubCan('owner', 'promote', 'admin'));
  assert.ok(!clubCan('admin', 'promote', 'member'));
  assert.ok(clubCan('owner', 'demote', 'admin'));
  assert.ok(!clubCan('owner', 'demote', 'member'));
  assert.ok(clubCan('owner', 'transfer', 'member'));
  assert.ok(!clubCan('owner', 'transfer', 'owner'));
  assert.ok(!clubCan('admin', 'transfer', 'member'));
  assert.ok(clubCan('owner', 'delete'));
  assert.ok(!clubCan('admin', 'delete'));
});

test('a club scores the points of its members', () => {
  assert.equal(
    clubPoints([
      { played: 4, won: 2 },
      { played: 1, won: 0 },
    ]),
    6 + 2 + 1,
  );
  assert.equal(clubPoints([]), 0);
});

test('clubs are ranked by points, wins, then the smaller club', () => {
  const lines = rankClubs([
    { club_id: 'a', played: 5, won: 1, members: 4 }, // 7 pts
    { club_id: 'b', played: 3, won: 2, members: 10 }, // 7 pts, more wins
    { club_id: 'c', played: 3, won: 2, members: 3 }, // same, smaller club
    { club_id: 'd', played: 0, won: 0, members: 2 },
    { club_id: 'e', played: -3, won: 9, members: 1 }, // nonsense is cleaned
  ]);
  assert.deepEqual(
    lines.map((l) => [l.club_id, l.place, l.points]),
    [
      ['c', 1, 7],
      ['b', 1, 7],
      ['a', 3, 7],
      ['e', 4, 0],
      ['d', 4, 0],
    ],
  );
});

test('the best three clubs of the week win a chest, only when two clubs played', () => {
  const lines = rankClubs([
    { club_id: 'a', played: 10, won: 5, members: 5 },
    { club_id: 'b', played: 8, won: 2, members: 5 },
    { club_id: 'c', played: 4, won: 1, members: 5 },
    { club_id: 'd', played: 2, won: 0, members: 5 },
    { club_id: 'e', played: 0, won: 0, members: 5 },
  ]);
  assert.equal(clubChest(lines, 'a'), 'grand');
  assert.equal(clubChest(lines, 'b'), 'normal');
  assert.equal(clubChest(lines, 'c'), 'normal');
  assert.equal(clubChest(lines, 'd'), null);
  assert.equal(clubChest(lines, 'e'), null);
  assert.equal(clubChest(lines, 'zz'), null);
  const alone = rankClubs([
    { club_id: 'a', played: 10, won: 5, members: 5 },
    { club_id: 'b', played: 0, won: 0, members: 5 },
  ]);
  assert.equal(clubChest(alone, 'a'), null);
});

test('a challenge is won head to head first, then on the whole week', () => {
  const side = (duelPlayed: number, duelWon: number, played: number, won: number) => ({
    duelPlayed,
    duelWon,
    played,
    won,
  });
  // They met: 2 games, A won both.
  assert.deepEqual(duelScore(side(2, 2, 3, 2), side(2, 0, 20, 10)), {
    duel: [6, 2],
    total: [7, 40],
    winner: 0,
    by: 'duel',
  });
  // They never met: the week decides.
  const week = duelScore(side(0, 0, 3, 1), side(0, 0, 4, 1));
  assert.equal(week.winner, 1);
  assert.equal(week.by, 'total');
  // Level everywhere: a draw.
  assert.deepEqual(duelScore(side(1, 0, 2, 1), side(1, 0, 2, 1)).winner, null);
  assert.equal(duelScore(side(0, 0, 0, 0), side(0, 0, 0, 0)).by, 'draw');
});

test('challenges: one between two clubs a week, one accepted per club, few pending', () => {
  const w = '2026-10-12';
  const c = (id: string, from: string, to: string, status: ClubChallengeRow['status'], week = w) => ({
    id,
    week,
    from_club: from,
    to_club: to,
    status,
  });
  assert.match(challengeRefusal('a', 'a', w, [])!, /lui-même/);
  assert.equal(challengeRefusal('a', 'b', w, []), null);
  assert.match(challengeRefusal('a', 'b', w, [c('1', 'b', 'a', 'pending')])!, /existe déjà/);
  assert.equal(challengeRefusal('a', 'b', w, [c('1', 'b', 'a', 'declined')]), null);
  assert.equal(challengeRefusal('a', 'b', w, [c('1', 'a', 'b', 'accepted', '2026-10-05')]), null);
  assert.match(challengeRefusal('a', 'b', w, [c('1', 'a', 'x', 'accepted')])!, /Ton club a déjà/);
  assert.match(challengeRefusal('a', 'b', w, [c('1', 'x', 'b', 'accepted')])!, /Ce club a déjà/);
  const pending = [c('1', 'a', 'x', 'pending'), c('2', 'a', 'y', 'pending'), c('3', 'a', 'z', 'pending')];
  assert.match(challengeRefusal('a', 'b', w, pending)!, /Trop de défis/);
  assert.equal(challengeRefusal('b', 'a', w, pending), null);
});

test('after leaving a club, a player waits a little before changing again', () => {
  const now = Date.parse('2026-10-12T10:00:00Z');
  assert.ok(canSwitchClub(null, now));
  assert.ok(!canSwitchClub(new Date(now - 60_000).toISOString(), now));
  assert.ok(canSwitchClub(now - CLUB_SWITCH_COOLDOWN_MS, now));
});
