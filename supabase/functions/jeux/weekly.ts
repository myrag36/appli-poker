// Rules of the Friday tournament on the server, without database access so they can be tested on
// their own. The schedule and the bracket live in the engine (weekly.ts); index.ts reads and
// writes the tables.
//
// No timer runs on the server. Everything happens on the next request:
// - any request in the 10 minutes before the start sends the "starts in 10 minutes" notice once;
// - the first request after the start builds the bracket and opens the first tables;
// - each table that ends moves the winner on and opens the next tables;
// - a table nobody finished WEEKLY_MATCH_MAX_MS after it opened is played out by the server.
import {
  type Rng,
  type WeeklyBracket,
  type WeeklyEntrant,
  type WeeklyMatch,
  WEEKLY_FIRST_TURN_MS,
  WEEKLY_MATCH_MAX_MS,
  WEEKLY_MAX_PLAYERS,
  WEEKLY_REMIND_MS,
  cleanAvatar,
  defaultAvatar,
  duelWinner,
  matchKey,
  nextWeeklyFriday,
  seedWeeklyBracket,
  setWeeklyWinner,
  settleWeekly,
  weeklyChampion,
  weeklyGameFor,
  weeklyMatchesPlaying,
  weeklyMatchesToOpen,
  weeklyStartsAt,
} from '../_shared/engine/index.ts';
import { GameError, cleanName } from '../poker/logic.ts';
import {
  type GameRoomRow,
  type GameSecret,
  type GameSnapshot,
  cleanOptions,
  gameDef,
  playGameTimeout,
  snapshot,
  startGame,
} from './logic.ts';

export type WeeklyStatus = 'open' | 'running' | 'finished' | 'cancelled';

export interface WeeklyRow {
  id: string;
  friday: string;
  starts_at: string;
  game: string;
  status: WeeklyStatus;
  bracket: WeeklyBracket | null;
  version: number;
  reminded: boolean;
  winner_id: string | null;
  winner_name: string | null;
  winner_avatar: string | null;
  winner_avatar_color: string | null;
  winner_bot: boolean | null;
  players: number;
  rewarded: boolean;
}

export interface WeeklyRegistration {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
}

/** The row of the next Friday, as first inserted. */
export function newWeeklyRow(now: number) {
  const friday = nextWeeklyFriday(now);
  return { friday, starts_at: new Date(weeklyStartsAt(friday)).toISOString(), game: weeklyGameFor(friday) };
}

export function weeklyDue(row: Pick<WeeklyRow, 'status' | 'starts_at'>, now: number): boolean {
  return row.status === 'open' && Date.parse(row.starts_at) <= now;
}

/** Whether the "starts in 10 minutes" notice should go now. */
export function weeklyRemindDue(
  row: Pick<WeeklyRow, 'status' | 'starts_at' | 'reminded'>,
  now: number,
): boolean {
  const at = Date.parse(row.starts_at);
  return row.status === 'open' && !row.reminded && now >= at - WEEKLY_REMIND_MS && now < at;
}

/** A sign-up: before the start, while there is room. Signing up again only updates the name. */
export function checkRegister(row: WeeklyRow, count: number, already: boolean, now: number) {
  if (row.status !== 'open' || Date.parse(row.starts_at) <= now) {
    throw new GameError('Les inscriptions sont closes');
  }
  if (!already && count >= WEEKLY_MAX_PLAYERS) throw new GameError('Le tournoi est complet');
}

export function checkUnregister(row: WeeklyRow, now: number) {
  if (row.status !== 'open' || Date.parse(row.starts_at) <= now) {
    throw new GameError('Le tournoi a déjà commencé');
  }
}

/** The row of a sign-up, name and avatar checked. */
export function registrationRow(
  tournamentId: string,
  userId: string,
  body: Record<string, unknown>,
  extraEmojis: string[],
) {
  const avatar = cleanAvatar(body.avatar, defaultAvatar(0), extraEmojis);
  return {
    tournament_id: tournamentId,
    user_id: userId,
    name: cleanName(body.name),
    avatar: avatar.emoji,
    avatar_color: avatar.color,
  };
}

/** The start: the bracket with everyone signed up, or cancelled when nobody came. */
export function startWeekly(
  regs: WeeklyRegistration[],
  rng: Rng,
  newId: () => string,
): { status: WeeklyStatus; bracket: WeeklyBracket | null; players: number } {
  if (regs.length === 0) return { status: 'cancelled', bracket: null, players: 0 };
  const people: WeeklyEntrant[] = regs
    .slice()
    .sort((a, b) => a.user_id.localeCompare(b.user_id))
    .map((r) => ({
      id: r.user_id,
      name: r.name,
      bot: false,
      avatar: r.avatar,
      avatar_color: r.avatar_color,
    }));
  return { status: 'running', bracket: seedWeeklyBracket(people, rng, newId), players: people.length };
}

/** The players of a match's table, seat 0 and 1, as rows of game_players. */
export function matchPlayers(m: WeeklyMatch) {
  return [m.a!, m.b!].map((e, seat) => ({
    user_id: e.id,
    name: e.name.slice(0, 16),
    seat,
    is_bot: e.bot,
    avatar: e.avatar ?? (e.bot ? '🤖' : null),
    avatar_color: e.avatar_color ?? null,
  }));
}

/** The room of a match before it is inserted (the first person of the match hosts it). */
export function matchRoom(weeklyId: string, game: string, m: WeeklyMatch) {
  const host = [m.a, m.b].find((e) => e && !e.bot);
  if (!host) throw new GameError('Deux robots ne jouent pas à une table');
  return {
    game,
    host_id: host.id,
    options: cleanOptions(game, {}),
    weekly_id: weeklyId,
    weekly_match: matchKey(m),
  };
}

/**
 * The game of a match, dealt as soon as the table opens. The first turn waits a little longer
 * than usual, so both players have time to arrive.
 */
export function startMatch(room: GameRoomRow, m: WeeklyMatch, rng: Rng, now: number): GameSnapshot {
  const players = matchPlayers(m);
  const { snapshot: snap } = startGame(room, players, room.host_id, () => crypto.randomUUID(), rng, now);
  const robotFirst = snap.public.actors.some((id) => snap.secret.seats.find((s) => s.id === id)?.bot);
  // A robot who plays first does not wait.
  if (snap.secret.deadline === null || robotFirst) return snap;
  const deadline = Math.max(snap.secret.deadline, now + WEEKLY_FIRST_TURN_MS);
  return { ...snap, secret: { ...snap.secret, deadline }, public: { ...snap.public, deadline } };
}

/** Who won a finished table of a match (its entrant id), or null while it goes on. */
export function matchOutcome(secret: GameSecret, m: WeeklyMatch, tieBreak: number): string | null {
  const def = gameDef(secret.game);
  if (!def.over(secret.state)) return null;
  const seat = duelWinner(def.winners(secret.state), tieBreak);
  const id = secret.seats[seat]?.id;
  return id === m.a?.id || id === m.b?.id ? id : null;
}

/** Whether a table has waited too long: the server then plays it to the end. */
export function matchOverdue(m: WeeklyMatch, now: number): boolean {
  return !m.winner && m.readyAt !== null && now - m.readyAt >= WEEKLY_MATCH_MAX_MS;
}

/** Plays a table to its end, every move chosen by the server, or null if it does not end. */
export function playOut(secret: GameSecret, rng: Rng, now: number, maxSteps = 20_000): GameSnapshot | null {
  const def = gameDef(secret.game);
  let current: GameSnapshot = snapshot(secret, now);
  for (let i = 0; i < maxSteps; i++) {
    if (def.over(current.secret.state)) return current;
    current = playGameTimeout({ ...current.secret, deadline: now }, rng, now);
  }
  return def.over(current.secret.state) ? current : null;
}

/** After the results: winners move on, robots meet by a draw; the champion once the final is played. */
export function advanceWeekly(
  bracket: WeeklyBracket,
  results: { key: string; winner: string; by: 'game' | 'timeout' }[],
  rng: Rng,
) {
  let out = bracket;
  for (const r of results) out = setWeeklyWinner(out, r.key, r.winner, r.by);
  out = settleWeekly(out, rng);
  return { bracket: out, champion: weeklyChampion(out), toOpen: weeklyMatchesToOpen(out) };
}

/** Records the table opened for a match. */
export function withRoom(
  bracket: WeeklyBracket,
  key: string,
  room: { id: string; code: string },
  now: number,
): WeeklyBracket {
  return {
    rounds: bracket.rounds.map((round) =>
      round.map((m) =>
        matchKey(m) === key && !m.roomId ? { ...m, roomId: room.id, code: room.code, readyAt: now } : m,
      ),
    ),
  };
}

/** Tables being played, to check for results or for players who never came. */
export function playingMatches(bracket: WeeklyBracket | null): WeeklyMatch[] {
  return bracket ? weeklyMatchesPlaying(bracket) : [];
}

/** People to tell their next match is ready: those of the tables opened by this change. */
export function matchNotices(
  before: WeeklyBracket | null,
  after: WeeklyBracket,
): { userId: string; opponent: string; code: string }[] {
  const had = new Set((before?.rounds.flat() ?? []).filter((m) => m.roomId).map((m) => matchKey(m)));
  const out: { userId: string; opponent: string; code: string }[] = [];
  for (const m of after.rounds.flat()) {
    if (!m.roomId || !m.code || had.has(matchKey(m)) || !m.a || !m.b) continue;
    if (!m.a.bot) out.push({ userId: m.a.id, opponent: m.b.name, code: m.code });
    if (!m.b.bot) out.push({ userId: m.b.id, opponent: m.a.name, code: m.code });
  }
  return out;
}

/** The champion's columns once the final is played. */
export function championColumns(champion: WeeklyEntrant, now: number) {
  return {
    status: 'finished' as const,
    winner_id: champion.id,
    winner_name: champion.name,
    winner_avatar: champion.avatar ?? null,
    winner_avatar_color: champion.avatar_color ?? null,
    winner_bot: champion.bot,
    finished_at: new Date(now).toISOString(),
  };
}

/** Whether the champion's reward is still to give: a person (not a robot), not paid yet. */
export function rewardDue(
  row: Pick<WeeklyRow, 'status' | 'winner_id' | 'winner_bot' | 'rewarded'>,
): row is WeeklyRow & { winner_id: string } {
  return row.status === 'finished' && !!row.winner_id && !row.winner_bot && !row.rewarded;
}

/** A past champion in the hall of fame, with how many Fridays they won. */
export interface HallOfFameLine {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  bot: boolean;
  wins: number;
  last: string;
}

type ChampionRow = Pick<
  WeeklyRow,
  'friday' | 'status' | 'winner_id' | 'winner_name' | 'winner_avatar' | 'winner_avatar_color' | 'winner_bot'
>;

/** Champions of the finished tournaments, most titles first (a robot after a person on a tie). */
export function hallOfFame(rows: ChampionRow[]): HallOfFameLine[] {
  const by = new Map<string, HallOfFameLine>();
  for (const r of rows.slice().sort((a, b) => a.friday.localeCompare(b.friday))) {
    if (r.status !== 'finished' || !r.winner_id) continue;
    // Robots have a new id each week: they are counted by name.
    const key = r.winner_bot ? `bot:${r.winner_name}` : r.winner_id;
    const line = by.get(key);
    by.set(key, {
      user_id: r.winner_id,
      name: r.winner_name ?? 'Joueur',
      avatar: r.winner_avatar,
      avatar_color: r.winner_avatar_color,
      bot: !!r.winner_bot,
      wins: (line?.wins ?? 0) + 1,
      last: r.friday,
    });
  }
  return [...by.values()].sort(
    (a, b) => b.wins - a.wins || Number(a.bot) - Number(b.bot) || b.last.localeCompare(a.last),
  );
}

/** What the phone sees of a tournament: no version nor internal flags. */
export function publicWeekly(row: WeeklyRow, regs: WeeklyRegistration[], userId: string) {
  return {
    id: row.id,
    friday: row.friday,
    startsAt: Date.parse(row.starts_at),
    game: row.game,
    status: row.status,
    bracket: row.bracket,
    registered: row.status === 'open' ? regs.length : row.players,
    me: regs.some((r) => r.user_id === userId),
    entrants: regs.map((r) => ({
      id: r.user_id,
      name: r.name,
      avatar: r.avatar,
      avatar_color: r.avatar_color,
    })),
    winner: row.winner_id
      ? {
          id: row.winner_id,
          name: row.winner_name ?? 'Joueur',
          avatar: row.winner_avatar,
          avatar_color: row.winner_avatar_color,
          bot: !!row.winner_bot,
        }
      : null,
  };
}
