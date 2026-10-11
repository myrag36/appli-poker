import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankLeaderboard } from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';
import {
  CLUB_INVITE_COOLDOWN_MS,
  canInviteClubToTable,
  canInviteToClubAgain,
  challengeScore,
  cleanId,
  cleanNewRole,
  clubCode,
  clubLook,
  clubMembers,
  clubWeekRows,
  eventBody,
  mustBeAllowed,
  mustSwitch,
  myClubChest,
  parisMidnight,
} from './logic.ts';
import {
  CLUB_URL,
  clubAcceptedNotice,
  clubChallengeNotice,
  clubInviteNotice,
  noticePayload,
} from '../_shared/notify.ts';

test('a club is created with a checked name, badge, color and description', () => {
  assert.deepEqual(clubLook({ name: '  Les  Rois ', emoji: '🐉', color: '#e63946', description: ' Go ' }), {
    name: 'Les Rois',
    emoji: '🐉',
    color: '#e63946',
    description: 'Go',
  });
  assert.throws(() => clubLook({ name: 'ab' }), GameError);
  assert.equal(clubLook({ name: 'Les As', emoji: '<script>', color: 'red' }).emoji, '🛡️');
  assert.equal(clubCode('abc-123'), 'ABC123');
  assert.throws(() => clubCode('abc'), /6 caractères/);
});

test('the server refuses what a role may not do, with a reason for the player', () => {
  assert.doesNotThrow(() => mustBeAllowed('admin', 'kick', 'member'));
  assert.throws(() => mustBeAllowed('admin', 'kick', 'admin'), /à ce membre/);
  assert.throws(() => mustBeAllowed('member', 'challenge'), /créateur et aux admins/);
  assert.throws(() => mustBeAllowed('admin', 'delete'), /Seul le créateur/);
  assert.throws(() => mustBeAllowed('owner', 'leave', undefined, false), /Confie d’abord/);
  assert.doesNotThrow(() => mustBeAllowed('owner', 'leave', undefined, true));
  assert.equal(cleanNewRole('admin'), 'admin');
  assert.throws(() => cleanNewRole('owner'), /Rôle inconnu/);
  assert.throws(() => cleanId('1; drop table', 'Ce club n’existe plus'), /n’existe plus/);
  assert.equal(cleanId('ABCDEF01-2345-6789-abcd-ef0123456789', 'x'), 'abcdef01-2345-6789-abcd-ef0123456789');
});

test('limits: switching clubs, invitations to the club and to a table', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  assert.throws(() => mustSwitch(new Date(now - 30_000).toISOString(), now), /attends quelques minutes/);
  assert.doesNotThrow(() => mustSwitch(null, now));
  assert.ok(!canInviteToClubAgain(new Date(now - 60_000).toISOString(), now));
  assert.ok(canInviteToClubAgain(new Date(now - CLUB_INVITE_COOLDOWN_MS).toISOString(), now));
  assert.ok(canInviteToClubAgain(undefined, now));
  assert.ok(!canInviteClubToTable(new Date(now - 10_000).toISOString(), now));
  assert.ok(canInviteClubToTable(new Date(now - 61_000).toISOString(), now));
});

test('the week ends at midnight in Paris, summer or winter time', () => {
  assert.equal(new Date(parisMidnight('2026-10-12')).toISOString(), '2026-10-11T22:00:00.000Z');
  assert.equal(new Date(parisMidnight('2026-11-02')).toISOString(), '2026-11-01T23:00:00.000Z');
});

test('members are ranked inside the club like friends, with their role', () => {
  const monday = '2026-10-12';
  const members = clubMembers(
    'b',
    [
      { user_id: 'a', name: 'Léa', role: 'owner', joined_at: '2026-10-01', week_start: monday, week_xp: 300 },
      { user_id: 'b', name: '', role: 'member', joined_at: '2026-10-02' },
      { user_id: 'c', name: 'Tom', role: 'bizarre', joined_at: '2026-10-03' },
    ],
    [
      { user_id: 'b', game: 'uno', won: true, week: monday },
      { user_id: 'b', game: 'uno', won: false, week: monday },
      { user_id: 'a', game: 'yams', won: true, week: monday },
      { user_id: 'c', game: 'yams', won: true, week: '2026-10-05' },
    ],
    monday,
  );
  assert.deepEqual(
    members.map((m) => [m.user_id, m.name, m.role, m.me]),
    [
      ['a', 'Léa', 'owner', false],
      ['b', 'Joueur', 'member', true],
      ['c', 'Tom', 'member', false],
    ],
  );
  const lines = rankLeaderboard(members, 'week');
  assert.deepEqual(
    lines.map((l) => [l.player.user_id, l.points, l.place]),
    [
      ['b', 4, 1],
      ['a', 3, 2],
      ['c', 0, 3],
    ],
  );
  assert.equal(rankLeaderboard(members, 'lastWeek')[0].player.user_id, 'c');
});

test('last week is kept with its places and members; only they win the chest', () => {
  const rows = clubWeekRows('2026-10-05', [
    { club_id: 'x', played: 10, won: 5, members: 2, member_ids: ['u1', 'u2'] },
    { club_id: 'y', played: 4, won: 0, members: 1, member_ids: ['u3'] },
    { club_id: 'z', played: 1, won: 0, members: 1, member_ids: ['u4'] },
    { club_id: 'w', played: 0, won: 0, members: 3, member_ids: ['u5'] },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.club_id, r.place, r.points]),
    [
      ['x', 1, 20],
      ['y', 2, 4],
      ['z', 3, 1],
      ['w', 4, 0],
    ],
  );
  assert.deepEqual(myClubChest(rows, 'u2'), { kind: 'grand', club_id: 'x', place: 1 });
  assert.deepEqual(myClubChest(rows, 'u4'), { kind: 'normal', club_id: 'z', place: 3 });
  assert.equal(myClubChest(rows, 'u5'), null);
  // A newcomer who joined after the week ended is not in the kept members.
  assert.equal(myClubChest(rows, 'nouveau'), null);
});

test('a challenge score comes from the two clubs and their games together', () => {
  const s = challengeScore(
    { played: 6, won: 2 },
    { played: 3, won: 3 },
    {
      a_played: 1,
      a_won: 0,
      b_played: 1,
      b_won: 1,
    },
  );
  assert.deepEqual(s, { duel: [1, 3], total: [10, 9], winner: 1, by: 'duel' });
  assert.equal(challengeScore(undefined, { played: 1, won: 0 }, undefined).winner, 1);
  assert.equal(challengeScore(undefined, undefined, undefined).by, 'draw');
});

test('events written in the lounge fit the database check', () => {
  const check = /^[a-z_]{1,24}(:.{0,40})?$/u;
  assert.equal(eventBody('arrivee'), 'arrivee');
  assert.equal(eventBody('defi_lance', 'Les Rois'), 'defi_lance:Les Rois');
  assert.ok(check.test(eventBody('defi_accepte', '🔥'.repeat(30))));
});

test('club notifications open the club, in the player’s language', () => {
  const fr = clubInviteNotice('fr', 'Léa', 'Les Rois', '🐉');
  assert.equal(fr.title, 'Léa t’invite dans son club');
  assert.match(fr.body, /« Les Rois »/);
  assert.equal(fr.url, CLUB_URL);
  assert.equal(clubInviteNotice('en', 'Léa', 'Les Rois', '🐉').title, 'Léa invites you to their club');
  assert.equal(clubChallengeNotice('en', 'Les Rois', '🐉').title, '⚔️ Your club is challenged!');
  assert.match(clubAcceptedNotice('fr', 'Les Rois', '🐉').body, /contre « Les Rois »/);
  assert.equal(JSON.parse(noticePayload(clubChallengeNotice('fr', 'X', '🛡️'))).kind, 'club');
});
