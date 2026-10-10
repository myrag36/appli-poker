// Weekly ranking between friends, made of the online games they finished (Monday to Sunday,
// Paris time). Games played on one phone are not counted: nobody can check them.
import { ONLINE_GAMES } from './online.ts';
import { parisDay } from './quests.ts';
import { weekStart } from './seasons.ts';

/** Points of a finished game: a win is worth 3, any other game 1. */
export const LEADERBOARD_WIN_POINTS = 3;
export const LEADERBOARD_PLAY_POINTS = 1;

/** Every game that can be finished online: poker and the games of the online registry. */
export function leaderboardGames(): string[] {
  return ['poker', ...Object.keys(ONLINE_GAMES)];
}

/** Games finished and won, for one game. */
export interface GameTally {
  played: number;
  won: number;
}

/** Games finished and won in a week, by game. */
export type WeekTally = Record<string, GameTally>;

/** A finished online game, as the server keeps it. */
export interface OnlineResult {
  user_id: string;
  game: string;
  won: boolean;
  /** Monday of the week the game ended in ("YYYY-MM-DD", Paris). */
  week: string;
}

/** A player in the ranking: me or a friend, with what we did this week and last week. */
export interface LeaderboardPlayer {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  xp: number;
  equipped: unknown;
  owned: unknown;
  me: boolean;
  week: WeekTally;
  lastWeek: WeekTally;
}

export interface LeaderboardLine {
  player: LeaderboardPlayer;
  /** 1 for the first; players with the same points and wins share a place. */
  place: number;
  played: number;
  won: number;
  points: number;
  /** The game that gave the most points, or null without any game. */
  best: string | null;
}

export function leaderboardPoints(t: GameTally): number {
  return t.won * LEADERBOARD_WIN_POINTS + (t.played - t.won) * LEADERBOARD_PLAY_POINTS;
}

/** The Monday a week before this one. */
export function previousWeek(monday: string): string {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** Counts each player's games this week and last week, by game. */
export function tallyResults(
  rows: OnlineResult[],
  monday: string,
): Map<string, { week: WeekTally; lastWeek: WeekTally }> {
  const before = previousWeek(monday);
  const out = new Map<string, { week: WeekTally; lastWeek: WeekTally }>();
  for (const r of rows) {
    const key = r.week === monday ? 'week' : r.week === before ? 'lastWeek' : null;
    if (!key) continue;
    if (!out.has(r.user_id)) out.set(r.user_id, { week: {}, lastWeek: {} });
    const tally = out.get(r.user_id)![key];
    const t = tally[r.game] ?? { played: 0, won: 0 };
    tally[r.game] = { played: t.played + 1, won: t.won + (r.won ? 1 : 0) };
  }
  return out;
}

/**
 * Ranks the players for one week (all games, or one), most points first, then most wins.
 * Players without a game stay at the bottom, so every friend is listed.
 */
export function rankLeaderboard(
  players: LeaderboardPlayer[],
  which: 'week' | 'lastWeek',
  game: string | null = null,
): LeaderboardLine[] {
  const lines = players.map((player) => {
    const tally = player[which] ?? {};
    const games = Object.entries(tally).filter(([g]) => game === null || g === game);
    let played = 0;
    let won = 0;
    let best: string | null = null;
    let bestScore = -1;
    for (const [g, t] of games.sort(([a], [b]) => a.localeCompare(b))) {
      played += t.played;
      won += t.won;
      const score = leaderboardPoints(t) * 1000 + t.won;
      if (t.played > 0 && score > bestScore) {
        best = g;
        bestScore = score;
      }
    }
    return { player, place: 0, played, won, points: leaderboardPoints({ played, won }), best };
  });
  lines.sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      Number(b.player.me) - Number(a.player.me) ||
      a.player.name.localeCompare(b.player.name),
  );
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    l.place = prev && prev.points === l.points && prev.won === l.won ? prev.place : i + 1;
  });
  return lines;
}

/** Last week's podium: the first three places among those who played. */
export function leaderboardPodium(
  players: LeaderboardPlayer[],
  game: string | null = null,
): LeaderboardLine[] {
  return rankLeaderboard(players, 'lastWeek', game).filter((l) => l.played > 0 && l.place <= 3);
}

/** Minutes Paris is ahead of UTC at this moment. */
export function parisOffset(at: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - Math.floor(at / 60_000) * 60_000) / 60_000);
}

/** When this week's ranking ends: next Monday at midnight, Paris time, in epoch milliseconds. */
export function weekEndsAt(now: number = Date.now()): number {
  const next = new Date(`${weekStart(parisDay(new Date(now)))}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 7);
  const guess = next.getTime();
  return guess - parisOffset(guess) * 60_000;
}
