// Partie rapide (quick games with strangers) and public tables, without any database access so it can
// be tested on its own: who waits, who is seated with whom, when a waiting player is a ghost, how
// often one may search, and whose rating a finished table changes.
import {
  ELO_START,
  type EloPlayer,
  ONLINE_GAMES,
  type OnlineGameId,
  QUICK_GAMES,
  type QuickGameId,
  eloDeltas,
  isQuickGame,
  levelFromXp,
  quickRequest,
} from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';

/** How often a waiting phone tells the server it is still there (and asks for news). */
export const QUEUE_PING_MS = 4_000;
/**
 * A waiting player not heard from for this long has left (closed tab, lost network): nobody is
 * seated with them. Long enough for a phone in the background, whose timers slow down to one a
 * minute, to keep its place and get the "opponent found" notification.
 */
export const QUEUE_STALE_MS = 75_000;
/** After this wait the player may start with whoever was found, robots taking the empty seats. */
export const QUEUE_FILL_AFTER_MS = 30_000;
/** A table found is kept on the queue row this long so the phone hears about it. */
export const QUEUE_MATCHED_KEEP_MS = 10 * 60_000;
/** Searches: at least 2 s apart, and at most 30 every 10 minutes. */
export const QUEUE_JOIN_GAP_MS = 2_000;
export const QUEUE_JOIN_LIMIT = 30;
export const QUEUE_JOIN_WINDOW_MS = 10 * 60_000;
/** The server looks for tables at most this often for one player (pings in between only answer). */
export const QUEUE_PAIR_GAP_MS = 1_500;
/** A public table waiting for players is listed this long, then it is forgotten. */
export const OPEN_TABLE_MS = 45 * 60_000;
/** Nobody needs more blocked players than this. */
export const MAX_BLOCKS = 500;

export type Visibility = 'private' | 'public' | 'quick';

export interface QueueRow {
  user_id: string;
  game: QuickGameId;
  size: number;
  variant: string;
  /** The player's rating in this game when they started searching. */
  rating: number;
  level: number;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  status: 'waiting' | 'matched' | 'left';
  joined_at: string;
  last_seen: string;
  room_id: string | null;
  /** Set once the table found is ready to be played. */
  room_code: string | null;
  /** Searches started since `joins_since`, for the rate limit. */
  joins: number;
  joins_since: string;
}

export interface BlockRow {
  user_id: string;
  blocked_id: string;
}

const ms = (iso: string) => Date.parse(iso);

/** Still searching, and heard from recently. */
export function isWaiting(row: QueueRow, now: number): boolean {
  return row.status === 'waiting' && now - ms(row.last_seen) <= QUEUE_STALE_MS;
}

/** Rows the server can delete: ghosts, people who left, tables found long ago. */
export function isExpired(row: QueueRow, now: number): boolean {
  if (row.status === 'matched') return now - ms(row.last_seen) > QUEUE_MATCHED_KEEP_MS;
  // A row that left is kept a while for the rate limit.
  if (row.status === 'left') return now - ms(row.joins_since) > QUEUE_JOIN_WINDOW_MS;
  return now - ms(row.last_seen) > QUEUE_STALE_MS;
}

/** Players seated together asked for the same game, table size and variant. */
export function queueKey(row: Pick<QueueRow, 'game' | 'size' | 'variant'>): string {
  return `${row.game}|${row.size}|${row.variant}`;
}

/**
 * How far apart two ratings may be: close at first, then wider every 10 seconds, anyone after a
 * minute (better a game than an endless wait).
 */
export function ratingWindow(waitedMs: number): number {
  if (waitedMs >= 60_000) return Infinity;
  return 100 + 100 * Math.floor(Math.max(0, waitedMs) / 10_000);
}

/** Every blocked pair, both ways: neither is ever seated with the other. */
export function blockedPairs(blocks: BlockRow[]): Set<string> {
  const out = new Set<string>();
  for (const b of blocks) {
    out.add(`${b.user_id}|${b.blocked_id}`);
    out.add(`${b.blocked_id}|${b.user_id}`);
  }
  return out;
}

function compatible(a: QueueRow, b: QueueRow, blocked: Set<string>, now: number): boolean {
  if (a.user_id === b.user_id || queueKey(a) !== queueKey(b)) return false;
  if (blocked.has(`${a.user_id}|${b.user_id}`)) return false;
  // The one who waited longer widens the search for both.
  const window = Math.max(ratingWindow(now - ms(a.joined_at)), ratingWindow(now - ms(b.joined_at)));
  return Math.abs(a.rating - b.rating) <= window;
}

/** Closest rating first, then closest level, then who waited longest. */
function closeness(me: QueueRow) {
  return (a: QueueRow, b: QueueRow) =>
    Math.abs(a.rating - me.rating) - Math.abs(b.rating - me.rating) ||
    Math.abs(a.level - me.level) - Math.abs(b.level - me.level) ||
    ms(a.joined_at) - ms(b.joined_at) ||
    a.user_id.localeCompare(b.user_id);
}

/** Waiting players who could sit with me now, best first. */
export function candidates(me: QueueRow, rows: QueueRow[], blocked: Set<string>, now: number): QueueRow[] {
  return rows.filter((r) => isWaiting(r, now) && compatible(me, r, blocked, now)).sort(closeness(me));
}

/**
 * Builds a group around `me` from the candidates: each one added must suit everyone already in
 * the group (ratings and blocks), up to `size` people.
 */
function growGroup(me: QueueRow, pool: QueueRow[], blocked: Set<string>, now: number, size: number) {
  const group = [me];
  for (const c of pool) {
    if (group.length >= size) break;
    if (group.every((g) => compatible(g, c, blocked, now))) group.push(c);
  }
  return group;
}

/**
 * Full tables that can be made now, as lists of user ids (who waited longest first, and they
 * get the first seat). The longest waiting player is served first, with the closest players.
 */
export function pairQueue(rows: QueueRow[], blocks: BlockRow[], now: number, maxTables = 5): string[][] {
  const blocked = blockedPairs(blocks);
  const waiting = rows
    .filter((r) => isWaiting(r, now))
    .sort((a, b) => ms(a.joined_at) - ms(b.joined_at) || a.user_id.localeCompare(b.user_id));
  const taken = new Set<string>();
  const tables: string[][] = [];
  for (const me of waiting) {
    if (tables.length >= maxTables) break;
    if (taken.has(me.user_id)) continue;
    const pool = candidates(
      me,
      waiting.filter((r) => !taken.has(r.user_id)),
      blocked,
      now,
    );
    const group = growGroup(me, pool, blocked, now, me.size);
    if (group.length < me.size) continue;
    group.sort((a, b) => ms(a.joined_at) - ms(b.joined_at) || a.user_id.localeCompare(b.user_id));
    for (const g of group) taken.add(g.user_id);
    tables.push(group.map((g) => g.user_id));
  }
  return tables;
}

/**
 * "Compléter avec des robots": me and the players found so far (those who would sit with me
 * now), robots taking the other seats. Only once I waited long enough.
 */
export function fillGroup(me: QueueRow, rows: QueueRow[], blocks: BlockRow[], now: number): string[] {
  if (!isWaiting(me, now)) throw new GameError('Tu ne cherches plus de partie');
  if (now - ms(me.joined_at) < QUEUE_FILL_AFTER_MS - 5_000) {
    throw new GameError('Attends encore un peu, on cherche des joueurs');
  }
  const blocked = blockedPairs(blocks);
  const group = growGroup(me, candidates(me, rows, blocked, now), blocked, now, me.size);
  return group
    .sort((a, b) => ms(a.joined_at) - ms(b.joined_at) || a.user_id.localeCompare(b.user_id))
    .map((g) => g.user_id);
}

/** What the waiting screen shows. */
export interface QueueStatus {
  status: 'waiting' | 'matched' | 'none';
  game?: QuickGameId;
  size?: number;
  variant?: string;
  /** Other players found so far, who would sit with me now. */
  found: number;
  /** How long I have been searching (ms). */
  waited: number;
  canFill: boolean;
  rating?: number;
  roomId?: string;
  code?: string;
}

export function queueStatus(
  me: QueueRow | null,
  rows: QueueRow[],
  blocks: BlockRow[],
  now: number,
): QueueStatus {
  if (me?.status === 'matched' && me.room_id && me.room_code) {
    return {
      status: 'matched',
      game: me.game,
      size: me.size,
      variant: me.variant,
      found: me.size - 1,
      waited: Math.max(0, now - ms(me.joined_at)),
      canFill: false,
      rating: me.rating,
      roomId: me.room_id,
      code: me.room_code,
    };
  }
  // Being seated: the table is not ready yet, keep waiting.
  if (
    !me ||
    (me.status !== 'waiting' && me.status !== 'matched') ||
    (me.status === 'waiting' && !isWaiting(me, now))
  ) {
    return { status: 'none', found: 0, waited: 0, canFill: false };
  }
  const waited = Math.max(0, now - ms(me.joined_at));
  const found =
    me.status === 'matched'
      ? me.size - 1
      : Math.min(me.size - 1, candidates(me, rows, blockedPairs(blocks), now).length);
  return {
    status: 'waiting',
    game: me.game,
    size: me.size,
    variant: me.variant,
    found,
    waited,
    canFill: me.status === 'waiting' && waited >= QUEUE_FILL_AFTER_MS,
    rating: me.rating,
  };
}

/**
 * A new search: checks the rate limit and returns the counters to save. One search at a time:
 * starting one replaces the previous (another game, or the same one again).
 */
export function checkQueueJoin(
  prev: Pick<QueueRow, 'joined_at' | 'joins' | 'joins_since'> | null,
  now: number,
) {
  if (prev && now - ms(prev.joined_at) < QUEUE_JOIN_GAP_MS) {
    throw new GameError('Doucement, réessaie dans un instant');
  }
  const fresh = !prev || now - ms(prev.joins_since) > QUEUE_JOIN_WINDOW_MS;
  const joins = fresh ? 1 : prev.joins + 1;
  if (joins > QUEUE_JOIN_LIMIT) throw new GameError('Trop de recherches, réessaie dans quelques minutes');
  return { joins, joins_since: new Date(fresh ? now : ms(prev!.joins_since)).toISOString() };
}

/** The queue row of a new search, checked. */
export function newQueueRow(
  userId: string,
  body: Record<string, unknown>,
  look: { name: string; avatar: string; avatar_color: string },
  rating: number,
  xp: number,
  prev: QueueRow | null,
  now: number,
): QueueRow {
  if (!isQuickGame(body.game)) throw new GameError('Jeu inconnu');
  const req = quickRequest(body.game, { size: body.size, variant: body.variant });
  const at = new Date(now).toISOString();
  return {
    user_id: userId,
    ...req,
    rating,
    level: levelFromXp(xp),
    ...look,
    status: 'waiting',
    joined_at: at,
    last_seen: at,
    room_id: null,
    room_code: null,
    ...checkQueueJoin(prev, now),
  };
}

/** Names at a table must differ: a second "Léa" becomes "Léa 2". */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let out = name;
    for (let n = 2; used.has(out.toLowerCase()); n++) out = `${name.slice(0, 13)} ${n}`;
    used.add(out.toLowerCase());
    return out;
  });
}

/** The seats of a quick table, in the group's order (who waited longest is the host, seat 0). */
export function quickSeats(group: QueueRow[]) {
  const names = uniqueNames(group.map((g) => g.name));
  return group.map((g, seat) => ({
    user_id: g.user_id,
    name: names[seat],
    seat,
    is_bot: false,
    avatar: g.avatar,
    avatar_color: g.avatar_color,
  }));
}

/** A quick table of an online game, ready to insert, before robots and the deal. */
export function quickGameRoom(roomId: string, code: string, group: QueueRow[]) {
  const game = group[0].game as OnlineGameId;
  if (!Object.hasOwn(ONLINE_GAMES, game)) throw new GameError('Jeu inconnu');
  return {
    room: {
      id: roomId,
      code,
      game,
      host_id: group[0].user_id,
      options: ONLINE_GAMES[game].options(QUICK_GAMES[game].options),
      visibility: 'quick' as Visibility,
    },
    players: quickSeats(group).map((p) => ({ ...p, room_id: roomId })),
  };
}

/** A quick poker table (a sit-and-go), ready to insert, before robots and the first deal. */
export function quickPokerRoom(roomId: string, code: string, group: QueueRow[]) {
  const o = QUICK_GAMES.poker.options as { bigBlind: number; stack: number; levelMinutes: number };
  return {
    room: {
      id: roomId,
      code,
      host_id: group[0].user_id,
      big_blind: o.bigBlind,
      starting_stack: o.stack,
      level_minutes: o.levelMinutes,
      variant: group[0].variant || 'holdem',
      visibility: 'quick' as Visibility,
    },
    players: quickSeats(group).map((p) => ({ ...p, room_id: roomId, stack: o.stack })),
  };
}

/** The choice made when creating a table: private (the default) or open to strangers. */
export function cleanVisibility(raw: unknown): 'private' | 'public' {
  return raw === 'public' ? 'public' : 'private';
}

/** Tables open to strangers change ratings; private tables between friends never do. */
export function isRated(visibility: string | null | undefined): boolean {
  return visibility === 'public' || visibility === 'quick';
}

/** A person at a finished table and their place (1 = won). */
export interface Placement {
  userId: string;
  place: number;
}

/** A person's rating in a game, as saved. */
export interface RatingRow {
  user_id: string;
  rating: number;
  games: number;
}

/** What `apply_ratings` saves for each person once a rated table ends. */
export interface RatingChange {
  user_id: string;
  delta: number;
  won: boolean;
}

/**
 * The rating changes of a table that just ended: only people count (robots never), and only
 * when at least two of them played.
 */
export function ratingChanges(placements: Placement[], ratings: RatingRow[]): RatingChange[] {
  if (placements.length < 2) return [];
  const byId = new Map(ratings.map((r) => [r.user_id, r]));
  const players: EloPlayer[] = placements.map((p) => ({
    id: p.userId,
    rating: byId.get(p.userId)?.rating ?? ELO_START,
    games: byId.get(p.userId)?.games ?? 0,
    place: p.place,
  }));
  const deltas = eloDeltas(players);
  const best = Math.min(...placements.map((p) => p.place));
  return placements.map((p) => ({ user_id: p.userId, delta: deltas[p.userId] ?? 0, won: p.place === best }));
}

/** Someone at the table blocked me, or I blocked them. */
export function blockedAtTable(
  userId: string,
  seated: { user_id: string; is_bot?: boolean }[],
  blocks: BlockRow[],
) {
  const blocked = blockedPairs(blocks);
  return seated.some((p) => !p.is_bot && blocked.has(`${userId}|${p.user_id}`));
}

/** A public table as the "Tables ouvertes" list shows it: only what strangers may see. */
export interface OpenTable {
  code: string;
  game: QuickGameId;
  players: number;
  max: number;
  host: { name: string; avatar: string | null; avatar_color: string | null; level: number };
  created_at: string;
}

export interface OpenRoomRow {
  id: string;
  code: string;
  game: QuickGameId;
  host_id: string;
  created_at: string;
}

/**
 * Public tables still waiting for players, newest first: not full, not too old, not mine, and
 * nobody I blocked (or who blocked me) is seated there.
 */
export function openTables(
  rooms: OpenRoomRow[],
  seated: {
    room_id: string;
    user_id: string;
    name: string;
    avatar: string | null;
    avatar_color: string | null;
    is_bot: boolean;
  }[],
  levels: Record<string, number>,
  blocks: BlockRow[],
  userId: string,
  now: number,
  limit = 30,
): OpenTable[] {
  const out: OpenTable[] = [];
  const sorted = rooms.slice().sort((a, b) => ms(b.created_at) - ms(a.created_at));
  for (const r of sorted) {
    if (now - ms(r.created_at) > OPEN_TABLE_MS) continue;
    const at = seated.filter((p) => p.room_id === r.id);
    const max = r.game === 'poker' ? 8 : ONLINE_GAMES[r.game as OnlineGameId]?.maxPlayers;
    if (!max || at.length >= max) continue;
    if (at.some((p) => p.user_id === userId)) continue;
    if (blockedAtTable(userId, at, blocks)) continue;
    const host = at.find((p) => p.user_id === r.host_id);
    if (!host) continue;
    out.push({
      code: r.code,
      game: r.game,
      players: at.length,
      max,
      host: {
        name: host.name,
        avatar: host.avatar,
        avatar_color: host.avatar_color,
        level: levels[host.user_id] ?? 1,
      },
      created_at: r.created_at,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** A player to block: someone else, and not too many. */
export function checkBlock(userId: string, target: unknown, count: number): string {
  const id = String(target ?? '').toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new GameError('Joueur inconnu');
  if (id === userId) throw new GameError('Tu ne peux pas te bloquer toi-même');
  if (count >= MAX_BLOCKS) throw new GameError('Tu as bloqué trop de joueurs');
  return id;
}

/** The row saved when blocking: who, and how they looked, to recognize them in the list. */
export function blockRow(userId: string, body: Record<string, unknown>, count: number) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 16) : '';
  const avatar = typeof body.avatar === 'string' && body.avatar.length <= 16 ? body.avatar : null;
  const color =
    typeof body.avatarColor === 'string' && /^#[0-9a-f]{6}$/i.test(body.avatarColor)
      ? body.avatarColor
      : null;
  return {
    user_id: userId,
    blocked_id: checkBlock(userId, body.userId, count),
    name: name || null,
    avatar,
    avatar_color: color,
  };
}

/**
 * The deletes that clear the queue, one per status: the same rows as `isExpired`, as columns
 * and dates the database can filter on.
 */
export function expiryCutoffs(now: number) {
  const at = (ago: number) => new Date(now - ago).toISOString();
  return [
    { status: 'waiting', column: 'last_seen', before: at(QUEUE_STALE_MS) },
    { status: 'matched', column: 'last_seen', before: at(QUEUE_MATCHED_KEEP_MS) },
    { status: 'left', column: 'joins_since', before: at(QUEUE_JOIN_WINDOW_MS) },
  ] as const;
}

/** A name at a public table: someone already called the same gets a number, like at a quick table. */
export function freeName(taken: string[], name: string): string {
  return uniqueNames([...taken, name])[taken.length];
}
