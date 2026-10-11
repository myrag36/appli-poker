// The Friday tournament: every Friday at 21:00 (Paris time) players who signed up meet in a
// knockout bracket, one game per week chosen in turn among the online games played one against
// one. Everything here is deterministic so the server needs no timer: the schedule is computed
// from the date, and the first request after the start builds the bracket.
import type { Rng } from './cards.ts';
import { ONLINE_BOT_NAMES, ONLINE_GAMES, type OnlineGameId } from './online.ts';
import { parisOffset } from './classement.ts';
import { parisDay } from './quests.ts';
import { weekStart } from './seasons.ts';

/** Friday (Monday = 0). */
export const WEEKLY_WEEKDAY = 4;
export const WEEKLY_HOUR = 21;
/** The "starts in 10 minutes" notice is sent from this long before the start. */
export const WEEKLY_REMIND_MS = 10 * 60_000;
/** Bracket of at most 32 players (5 rounds). */
export const WEEKLY_MAX_PLAYERS = 32;
/**
 * A match nobody finished this long after its table opened is played to the end by the server
 * (moves chosen for the absent players), so the bracket never stays stuck.
 */
export const WEEKLY_MATCH_MAX_MS = 25 * 60_000;
/** Before the first move of a match, players get this long to arrive at the table. */
export const WEEKLY_FIRST_TURN_MS = 3 * 60_000;
/** The champion's reward: coins, a title only champions can wear, and a trophy (feat). */
export const WEEKLY_COINS = 300;
export const WEEKLY_TITLE = 'vendredi';
export const WEEKLY_FEAT = 'tournoi-vendredi';

/** Epoch milliseconds of a Paris wall-clock time on a day ("YYYY-MM-DD"). */
export function parisTime(day: string, hour: number, minute = 0): number {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  // The offset at the guess is the right one except within an hour of a change (never on Friday evening).
  const first = guess - parisOffset(guess) * 60_000;
  return guess - parisOffset(first) * 60_000;
}

function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** When the tournament of this Friday starts, in epoch milliseconds. */
export function weeklyStartsAt(friday: string): number {
  return parisTime(friday, WEEKLY_HOUR);
}

/** The Friday ("YYYY-MM-DD") of the next tournament still to start, strictly after `now`. */
export function nextWeeklyFriday(now: number = Date.now()): string {
  const friday = addDays(weekStart(parisDay(new Date(now))), WEEKLY_WEEKDAY);
  return weeklyStartsAt(friday) > now ? friday : addDays(friday, 7);
}

/** The Friday of the last tournament that already started (at or before `now`). */
export function lastWeeklyFriday(now: number = Date.now()): string {
  return addDays(nextWeeklyFriday(now), -7);
}

/**
 * Games that can be played one against one online: any game of the registry that seats exactly
 * two players without robots. New games join the rotation on their own.
 */
export function weeklyGames(): OnlineGameId[] {
  return (Object.keys(ONLINE_GAMES) as OnlineGameId[]).filter((id) => {
    const g = ONLINE_GAMES[id];
    return g.minPlayers <= 2 && g.maxPlayers >= 2 && (g.fillTo ?? 0) <= 2;
  });
}

/** The game of a Friday: the eligible games in turn, one per week. */
export function weeklyGameFor(friday: string, games: readonly OnlineGameId[] = weeklyGames()): OnlineGameId {
  const weeks = Math.floor(Date.parse(`${friday}T00:00:00Z`) / (7 * 86_400_000));
  return games[((weeks % games.length) + games.length) % games.length];
}

// ---------------------------------------------------------------------------
// The bracket

export interface WeeklyEntrant {
  id: string;
  name: string;
  bot: boolean;
  avatar?: string | null;
  avatar_color?: string | null;
}

/** How a match was decided: at the table, by a draw between two robots, or played out by the server. */
export type WeeklyDecision = 'game' | 'draw' | 'timeout';

export interface WeeklyMatch {
  round: number;
  slot: number;
  a: WeeklyEntrant | null;
  b: WeeklyEntrant | null;
  /** Id of the entrant who goes through. */
  winner: string | null;
  by: WeeklyDecision | null;
  /** The table of the match, once both players are known. */
  roomId: string | null;
  code: string | null;
  /** When its table opened (epoch ms). */
  readyAt: number | null;
}

export interface WeeklyBracket {
  /** rounds[0] is the first round; the last one holds the final. */
  rounds: WeeklyMatch[][];
}

export function matchKey(m: Pick<WeeklyMatch, 'round' | 'slot'>): string {
  return `${m.round}-${m.slot}`;
}

/** Players in the bracket: the next power of two, at least 2. */
export function bracketSize(players: number): number {
  let size = 2;
  while (size < players) size *= 2;
  return size;
}

/**
 * Standard seeding: position of each seed in the first round, so seed 1 meets the last one and
 * the best seeds can only meet at the end. Robots take the last seeds, so they face people.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

function emptyMatch(round: number, slot: number): WeeklyMatch {
  return { round, slot, a: null, b: null, winner: null, by: null, roomId: null, code: null, readyAt: null };
}

/** Robot names for the free seats of the bracket. */
export function weeklyBotName(i: number): string {
  return ONLINE_BOT_NAMES[i] ?? `Robot ${i + 1}`;
}

/**
 * The bracket at the start: people in a random order, robots in the free seats, then robots
 * against robots decided at once.
 */
export function seedWeeklyBracket(people: WeeklyEntrant[], rng: Rng, newBotId: () => string): WeeklyBracket {
  const humans = people.slice(0, WEEKLY_MAX_PLAYERS);
  for (let i = humans.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [humans[i], humans[j]] = [humans[j], humans[i]];
  }
  const size = bracketSize(humans.length);
  const seeds: WeeklyEntrant[] = [...humans];
  for (let i = 0; seeds.length < size; i++) {
    seeds.push({ id: newBotId(), name: weeklyBotName(i), bot: true, avatar: '🤖', avatar_color: '#90be6d' });
  }
  const order = seedOrder(size);
  const rounds: WeeklyMatch[][] = [];
  for (let r = 0, n = size / 2; n >= 1; r++, n /= 2) {
    rounds.push(Array.from({ length: n }, (_, s) => emptyMatch(r, s)));
  }
  rounds[0].forEach((m, s) => {
    m.a = seeds[order[2 * s] - 1];
    m.b = seeds[order[2 * s + 1] - 1];
  });
  return settleWeekly({ rounds }, rng);
}

function copy(bracket: WeeklyBracket): WeeklyBracket {
  return { rounds: bracket.rounds.map((round) => round.map((m) => ({ ...m }))) };
}

function entrant(m: WeeklyMatch, id: string | null): WeeklyEntrant | null {
  if (!id) return null;
  if (m.a?.id === id) return m.a;
  if (m.b?.id === id) return m.b;
  return null;
}

/** Winners move on to the next round, and two robots meeting are decided by a draw. */
export function settleWeekly(bracket: WeeklyBracket, rng: Rng): WeeklyBracket {
  const out = copy(bracket);
  out.rounds.forEach((round, r) => {
    round.forEach((m) => {
      if (!m.winner && m.a?.bot && m.b?.bot) {
        m.winner = rng(2) === 0 ? m.a.id : m.b.id;
        m.by = 'draw';
      }
      const next = out.rounds[r + 1]?.[Math.floor(m.slot / 2)];
      if (next && m.winner) {
        const side = m.slot % 2 === 0 ? 'a' : 'b';
        if (!next[side]) next[side] = entrant(m, m.winner);
      }
    });
  });
  return out;
}

/** Records who won a match (only once: a second result is ignored). */
export function setWeeklyWinner(
  bracket: WeeklyBracket,
  key: string,
  winnerId: string,
  by: WeeklyDecision,
): WeeklyBracket {
  const out = copy(bracket);
  const m = out.rounds.flat().find((x) => matchKey(x) === key);
  if (!m) throw new Error('Match introuvable');
  if (m.winner) return out;
  if (!entrant(m, winnerId)) throw new Error('Ce joueur ne joue pas ce match');
  m.winner = winnerId;
  m.by = by;
  return out;
}

/** Matches whose two players are known and whose table must now be opened. */
export function weeklyMatchesToOpen(bracket: WeeklyBracket): WeeklyMatch[] {
  return bracket.rounds.flat().filter((m) => m.a && m.b && !m.winner && !m.roomId && (!m.a.bot || !m.b.bot));
}

/** Matches being played at a table. */
export function weeklyMatchesPlaying(bracket: WeeklyBracket): WeeklyMatch[] {
  return bracket.rounds.flat().filter((m) => m.roomId && !m.winner);
}

/** The winner of the final, once it is played. */
export function weeklyChampion(bracket: WeeklyBracket): WeeklyEntrant | null {
  const final = bracket.rounds[bracket.rounds.length - 1]?.[0];
  return final ? entrant(final, final.winner) : null;
}

/** The match a player has to play now or is waiting for, or null once out (or champion). */
export function weeklyMatchOf(bracket: WeeklyBracket, userId: string): WeeklyMatch | null {
  let current: WeeklyMatch | null = null;
  for (const m of bracket.rounds.flat()) {
    if (m.a?.id !== userId && m.b?.id !== userId) continue;
    if (m.winner && m.winner !== userId) return null;
    if (!m.winner) current = m;
  }
  return current;
}

/** Whether a player is out of the tournament. */
export function weeklyKnockedOut(bracket: WeeklyBracket, userId: string): boolean {
  return bracket.rounds
    .flat()
    .some((m) => (m.a?.id === userId || m.b?.id === userId) && m.winner && m.winner !== userId);
}

/**
 * The seat (0 or 1) that wins a one-against-one table from the game's winners. A tie (both or
 * nobody first) is broken by `tieBreak` (0 or 1), drawn by the server.
 */
export function duelWinner(winners: number[], tieBreak: number): 0 | 1 {
  const a = winners.includes(0);
  const b = winners.includes(1);
  if (a !== b) return a ? 0 : 1;
  return tieBreak === 1 ? 1 : 0;
}

/** Name of a round for display: the last ones have names, the first ones a number. */
export function weeklyRoundName(round: number, rounds: number): string {
  const left = rounds - round;
  if (left === 1) return 'Finale';
  if (left === 2) return 'Demi-finales';
  if (left === 3) return 'Quarts de finale';
  if (left === 4) return 'Huitièmes de finale';
  return 'Seizièmes de finale';
}
