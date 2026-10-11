// Clubs: a group of friends (30 at most) with a lounge, a weekly ranking of its own and
// challenges against other clubs. A player is in one club at a time. A club's weekly points are
// the sum of its members' points in the weekly ranking (online games: 3 a win, 1 any other
// game, see classement.ts). The best three clubs of last week win a chest for their members.
import { type GameTally, type LeaderboardLine, leaderboardPoints } from './classement.ts';

export const CLUB_NAME_MIN = 3;
export const CLUB_NAME_MAX = 24;
export const CLUB_DESCRIPTION_MAX = 140;
export const CLUB_MAX_MEMBERS = 30;
/** Invitations waiting for an answer, per club. */
export const CLUB_MAX_INVITES = 30;
/** Challenges a club may send in a week and still be waiting for an answer. */
export const CLUB_MAX_PENDING_CHALLENGES = 3;
/** After leaving a club, a player waits this long before creating or joining another one. */
export const CLUB_SWITCH_COOLDOWN_MS = 10 * 60_000;
/** Places of last week's club ranking that win a chest. */
export const CLUB_PODIUM = 3;

export const CLUB_EMOJIS = [
  '🛡️',
  '⚔️',
  '🦁',
  '🐺',
  '🐉',
  '🦊',
  '🐙',
  '🔥',
  '⚡',
  '👑',
  '💎',
  '🍀',
  '🌙',
  '🎲',
  '🃏',
  '🚀',
];

export const CLUB_COLORS = [
  '#e63946',
  '#f4a261',
  '#e9c46a',
  '#90be6d',
  '#2a9d8f',
  '#4ea8de',
  '#8e7dbe',
  '#d17a9e',
];

export type ClubRole = 'owner' | 'admin' | 'member';

/** Something done in a club, for `clubCan`. */
export type ClubAction =
  | 'invite'
  | 'edit'
  | 'newCode'
  | 'kick'
  | 'promote'
  | 'demote'
  | 'transfer'
  | 'challenge'
  | 'delete'
  | 'leave';

const RANK: Record<ClubRole, number> = { owner: 3, admin: 2, member: 1 };

export function isClubRole(raw: unknown): raw is ClubRole {
  return raw === 'owner' || raw === 'admin' || raw === 'member';
}

/**
 * Whether a member with this role may do this, to this other member when there is one:
 * - everyone invites friends and may leave (the owner first hands the club over, unless alone);
 * - the owner and admins change the name, badge and code, and challenge other clubs (or answer);
 * - the owner removes anyone, admins only plain members;
 * - only the owner names or removes admins, hands the club over, or deletes it.
 */
export function clubCan(
  role: ClubRole,
  action: ClubAction,
  target?: ClubRole,
  options: { alone?: boolean } = {},
): boolean {
  switch (action) {
    case 'invite':
      return true;
    case 'leave':
      return role !== 'owner' || options.alone === true;
    case 'edit':
    case 'newCode':
    case 'challenge':
      return RANK[role] >= RANK.admin;
    case 'kick':
      return !!target && target !== 'owner' && RANK[role] > RANK[target] && RANK[role] >= RANK.admin;
    case 'promote':
      return role === 'owner' && target === 'member';
    case 'demote':
      return role === 'owner' && target === 'admin';
    case 'transfer':
      return role === 'owner' && !!target && target !== 'owner';
    case 'delete':
      return role === 'owner';
  }
  return false;
}

/** Characters players type in names: no control or direction characters, single spaces. */
function cleanText(raw: unknown): string {
  return (
    String(raw ?? '')
      // deno-lint-ignore no-control-regex
      .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** A club name as kept, or an error to show (in French, as the servers answer). */
export function cleanClubName(raw: unknown): { name: string } | { error: string } {
  const name = cleanText(raw);
  const length = Array.from(name).length;
  if (length < CLUB_NAME_MIN || length > CLUB_NAME_MAX) {
    return { error: 'Le nom du club fait de 3 à 24 caractères' };
  }
  return { name };
}

/** A club description: one paragraph of at most 140 characters (longer ones are cut). */
export function cleanClubDescription(raw: unknown): string {
  const chars = Array.from(cleanText(raw));
  return chars.slice(0, CLUB_DESCRIPTION_MAX).join('').trim();
}

/** The club's badge and color, kept only when they are among the offered ones. */
export function cleanClubLook(emoji: unknown, color: unknown): { emoji: string; color: string } {
  return {
    emoji: CLUB_EMOJIS.includes(emoji as string) ? (emoji as string) : CLUB_EMOJIS[0],
    color: CLUB_COLORS.includes(color as string) ? (color as string) : CLUB_COLORS[5],
  };
}

/** A club invite code typed or opened from a link: 6 letters or digits. */
export function cleanClubCode(raw: unknown): string | null {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return code.length === 6 ? code : null;
}

/** Games played and won by a club's members in a week, as the database adds them up. */
export interface ClubTally {
  club_id: string;
  played: number;
  won: number;
  /** Members counted. */
  members: number;
}

export interface ClubLine {
  club_id: string;
  /** 1 for the first; clubs with the same points and wins share a place. */
  place: number;
  points: number;
  played: number;
  won: number;
  members: number;
}

/** A club's points: the sum of its members' points in the weekly ranking. */
export function clubPoints(members: (GameTally | LeaderboardLine)[]): number {
  return members.reduce((sum, m) => sum + ('points' in m ? m.points : leaderboardPoints(m as GameTally)), 0);
}

/**
 * Ranks the clubs of a week: most points first, then most wins, then the smaller club (it did
 * as much with fewer players), then by id so the order never moves.
 */
export function rankClubs(tallies: ClubTally[]): ClubLine[] {
  const lines = tallies.map((c) => {
    const played = Math.max(0, c.played | 0);
    const won = Math.min(played, Math.max(0, c.won | 0));
    return {
      club_id: c.club_id,
      place: 0,
      played,
      won,
      points: leaderboardPoints({ played, won }),
      members: Math.max(0, c.members | 0),
    };
  });
  lines.sort(
    (a, b) =>
      b.points - a.points || b.won - a.won || a.members - b.members || a.club_id.localeCompare(b.club_id),
  );
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    l.place = prev && prev.points === l.points && prev.won === l.won ? prev.place : i + 1;
  });
  return lines;
}

/**
 * The chest last week's ranking gives a club's members: a grand one for the first club, a chest
 * for the second and third. A club needs points, and at least two clubs must have played.
 */
export function clubChest(lines: ClubLine[], clubId: string): 'grand' | 'normal' | null {
  const playing = lines.filter((l) => l.points > 0);
  if (playing.length < 2) return null;
  const mine = playing.find((l) => l.club_id === clubId);
  if (!mine || mine.place > CLUB_PODIUM) return null;
  return mine.place === 1 ? 'grand' : 'normal';
}

/** One side of a challenge: games between the two clubs' members, and the whole week. */
export interface DuelSide {
  /** Games at a table where both clubs had a member (head to head). */
  duelPlayed: number;
  duelWon: number;
  /** Every online game of the week. */
  played: number;
  won: number;
}

export interface DuelScore {
  /** Points from head-to-head games, then over the whole week. */
  duel: [number, number];
  total: [number, number];
  /** 0 for the challenging club, 1 for the other one, null for a draw. */
  winner: 0 | 1 | null;
  /** What decided it. */
  by: 'duel' | 'total' | 'draw';
}

/**
 * Who wins a challenge. Games where members of both clubs sat at the same table count first:
 * that is the real match between the clubs. If they did not meet (or are level), the club with
 * the most points over the whole week wins, so a challenge always means something.
 */
export function duelScore(a: DuelSide, b: DuelSide): DuelScore {
  const pts = (played: number, won: number) =>
    leaderboardPoints({ played: Math.max(0, played), won: Math.min(Math.max(0, won), Math.max(0, played)) });
  const duel: [number, number] = [pts(a.duelPlayed, a.duelWon), pts(b.duelPlayed, b.duelWon)];
  const total: [number, number] = [pts(a.played, a.won), pts(b.played, b.won)];
  if (duel[0] !== duel[1]) return { duel, total, winner: duel[0] > duel[1] ? 0 : 1, by: 'duel' };
  if (total[0] !== total[1]) return { duel, total, winner: total[0] > total[1] ? 0 : 1, by: 'total' };
  return { duel, total, winner: null, by: 'draw' };
}

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

/** A challenge between two clubs for one week, as the server keeps it. */
export interface ClubChallengeRow {
  id: string;
  week: string;
  from_club: string;
  to_club: string;
  status: ChallengeStatus;
}

/**
 * Why a club may not challenge another one this week, or null when it may: not itself, not a
 * club already in an accepted challenge, not twice the same pair, and not too many unanswered.
 */
export function challengeRefusal(
  from: string,
  to: string,
  week: string,
  challenges: ClubChallengeRow[],
): string | null {
  if (from === to) return 'Ton club ne peut pas se défier lui-même';
  const thisWeek = challenges.filter(
    (c) => c.week === week && (c.status === 'pending' || c.status === 'accepted'),
  );
  const involves = (c: ClubChallengeRow, id: string) => c.from_club === id || c.to_club === id;
  if (thisWeek.some((c) => involves(c, from) && involves(c, to))) {
    return 'Un défi entre ces deux clubs existe déjà cette semaine';
  }
  if (thisWeek.some((c) => c.status === 'accepted' && involves(c, from))) {
    return 'Ton club a déjà un défi cette semaine';
  }
  if (thisWeek.some((c) => c.status === 'accepted' && involves(c, to))) {
    return 'Ce club a déjà un défi cette semaine';
  }
  if (
    thisWeek.filter((c) => c.status === 'pending' && c.from_club === from).length >=
    CLUB_MAX_PENDING_CHALLENGES
  ) {
    return 'Trop de défis en attente, patiente qu’ils répondent';
  }
  return null;
}

/** Whether a player who left a club at this time may join or create another one now. */
export function canSwitchClub(leftAt: string | number | null | undefined, now: number): boolean {
  if (leftAt === null || leftAt === undefined) return true;
  const at = typeof leftAt === 'number' ? leftAt : new Date(leftAt).getTime();
  return !Number.isFinite(at) || now - at >= CLUB_SWITCH_COOLDOWN_MS;
}
