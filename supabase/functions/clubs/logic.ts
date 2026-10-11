// Rules of the clubs server, without database access so they can be tested on their own.
import {
  type ClubAction,
  type ClubLine,
  type ClubRole,
  type ClubTally,
  type DuelScore,
  type LeaderboardPlayer,
  type OnlineResult,
  canSwitchClub,
  cleanClubCode,
  cleanClubDescription,
  cleanClubLook,
  cleanClubName,
  clubCan,
  clubChest,
  duelScore,
  isClubRole,
  parisOffset,
  rankClubs,
  tallyResults,
} from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';
import { type LeaderboardPerson, weekXpOf } from '../profil/logic.ts';

/** Midnight at the start of this day in Paris, in epoch milliseconds. */
export function parisMidnight(day: string): number {
  const guess = Date.parse(`${day}T00:00:00Z`);
  return guess - parisOffset(guess) * 60_000;
}

/** The name, badge, color and description of a club, as asked, checked. */
export function clubLook(body: Record<string, unknown>) {
  const name = cleanClubName(body.name);
  if ('error' in name) throw new GameError(name.error);
  return {
    name: name.name,
    ...cleanClubLook(body.emoji, body.color),
    description: cleanClubDescription(body.description),
  };
}

export function clubCode(raw: unknown): string {
  const code = cleanClubCode(raw);
  if (!code) throw new GameError('Un code de club a 6 caractères');
  return code;
}

/** Throws the reason when a member with this role may not do this (to this member). */
export function mustBeAllowed(role: ClubRole, action: ClubAction, target?: ClubRole, alone?: boolean) {
  if (clubCan(role, action, target, { alone })) return;
  if (action === 'leave') throw new GameError('Confie d’abord ton club à un autre membre');
  if (action === 'kick' || action === 'promote' || action === 'demote') {
    throw new GameError('Tu ne peux pas faire ça à ce membre');
  }
  if (role === 'member') throw new GameError('Réservé au créateur et aux admins du club');
  throw new GameError('Seul le créateur du club peut faire ça');
}

/** The role asked for a member: admin or plain member. */
export function cleanNewRole(raw: unknown): 'admin' | 'member' {
  if (raw !== 'admin' && raw !== 'member') throw new GameError('Rôle inconnu');
  return raw;
}

export function mustSwitch(leftAt: string | null | undefined, now: number) {
  if (!canSwitchClub(leftAt, now)) {
    throw new GameError('Tu viens de quitter un club : attends quelques minutes');
  }
}

/** A member re-invites the same friend at most once an hour. */
export const CLUB_INVITE_COOLDOWN_MS = 3_600_000;

export function canInviteToClubAgain(lastSent: string | null | undefined, now: number): boolean {
  return !lastSent || now - new Date(lastSent).getTime() >= CLUB_INVITE_COOLDOWN_MS;
}

/** One invitation to a table a minute per member, for the whole club. */
export const CLUB_GAME_INVITE_COOLDOWN_MS = 60_000;

export function canInviteClubToTable(lastSent: string | null | undefined, now: number): boolean {
  return !lastSent || now - new Date(lastSent).getTime() >= CLUB_GAME_INVITE_COOLDOWN_MS;
}

/** A member of the club, as read from the members, profiles and progress tables. */
export interface MemberRow extends LeaderboardPerson {
  role: string;
  joined_at: string;
}

export type ClubMember = LeaderboardPlayer & { role: ClubRole; joined_at: string };

/**
 * The members with their games of the week (and last week), for the club's own ranking: the
 * phone ranks them with `rankLeaderboard`, as the friends' ranking.
 */
export function clubMembers(
  meId: string,
  rows: MemberRow[],
  results: OnlineResult[],
  monday: string,
): ClubMember[] {
  const tallies = tallyResults(results, monday);
  return rows.map((p) => {
    const xp = weekXpOf(p, monday);
    return {
      user_id: p.user_id,
      name: p.name || 'Joueur',
      avatar: p.avatar ?? null,
      avatar_color: p.avatar_color ?? null,
      xp: p.xp ?? 0,
      equipped: p.equipped ?? {},
      owned: p.owned ?? [],
      me: p.user_id === meId,
      week: tallies.get(p.user_id)?.week ?? {},
      lastWeek: tallies.get(p.user_id)?.lastWeek ?? {},
      weekXp: xp.week,
      lastWeekXp: xp.lastWeek,
      role: isClubRole(p.role) ? p.role : 'member',
      joined_at: p.joined_at,
    };
  });
}

/** What the database adds up for each club in a week, with the members counted. */
export interface ClubTallyRow extends ClubTally {
  member_ids: string[];
}

/** Last week's ranking as kept once the week is over: places, points and who wins a chest. */
export interface ClubWeekRow {
  week: string;
  club_id: string;
  place: number;
  points: number;
  members: string[];
}

export function clubWeekRows(week: string, tallies: ClubTallyRow[]): ClubWeekRow[] {
  const ids = new Map(tallies.map((t) => [t.club_id, t.member_ids ?? []]));
  return rankClubs(tallies).map((l) => ({
    week,
    club_id: l.club_id,
    place: l.place,
    points: l.points,
    members: ids.get(l.club_id) ?? [],
  }));
}

/** My chest for last week's club ranking: the club I was in when the week ended decides. */
export function myClubChest(
  rows: ClubWeekRow[],
  meId: string,
): { kind: 'grand' | 'normal'; club_id: string; place: number } | null {
  const mine = rows.find((r) => r.members.includes(meId));
  if (!mine) return null;
  const lines: ClubLine[] = rows.map((r) => ({
    club_id: r.club_id,
    place: r.place,
    points: r.points,
    played: 0,
    won: 0,
    members: r.members.length,
  }));
  const kind = clubChest(lines, mine.club_id);
  return kind ? { kind, club_id: mine.club_id, place: mine.place } : null;
}

/** A challenge and its score: from the challenging club's side first. */
export function challengeScore(
  a: { played: number; won: number } | undefined,
  b: { played: number; won: number } | undefined,
  duel: { a_played: number; a_won: number; b_played: number; b_won: number } | undefined,
): DuelScore {
  return duelScore(
    {
      duelPlayed: duel?.a_played ?? 0,
      duelWon: duel?.a_won ?? 0,
      played: a?.played ?? 0,
      won: a?.won ?? 0,
    },
    {
      duelPlayed: duel?.b_played ?? 0,
      duelWon: duel?.b_won ?? 0,
      played: b?.played ?? 0,
      won: b?.won ?? 0,
    },
  );
}

/** What happened in a club, written in its lounge: a code the phone turns into a sentence. */
export type ClubEvent =
  | 'creation'
  | 'arrivee'
  | 'depart'
  | 'exclusion'
  | 'createur'
  | 'admin'
  | 'defi_lance'
  | 'defi_recu'
  | 'defi_accepte'
  | 'defi_refuse';

/** An event's body: its code, and the other club's name for challenges. */
export function eventBody(event: ClubEvent, club?: string): string {
  return club ? `${event}:${Array.from(club).slice(0, 24).join('')}` : event;
}

/** An id of a club or a challenge, as the database makes them. */
export function cleanId(raw: unknown, error: string): string {
  const id = String(raw ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new GameError(error);
  return id.toLowerCase();
}
