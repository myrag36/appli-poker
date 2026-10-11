// Database side of the tables classées, shared by the `jeux` and `poker` servers: ranks read and
// saved, finished and abandoned ranked tables, season rewards and the leaderboard. The rules are
// in ranks.ts, the decisions in jeux/classees.ts.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { LEGEND_TOP, MASTER_POINTS, type SeasonReward, isRankedGame, seasonKey } from './engine/index.ts';
import {
  type RankedRow,
  boardLines,
  endPlacements,
  forfeitPlan,
  maitreGames,
  myRanks,
  rankedStarts,
  rankedUpdates,
  rewardFor,
  seasonsToClaim,
} from '../jeux/classees.ts';
import type { Placement } from '../jeux/rapide.ts';
import { GameError } from '../poker/logic.ts';
import { loadRatings } from './rapide.ts';

const RANK_COLUMNS =
  'user_id, game, season, points, games, wins, shield, placement, peak, name, avatar, avatar_color, updated_at';

/** These players' rows in one game, this season and before. */
async function loadRankRows(db: SupabaseClient, game: string, ids: string[], season: string) {
  const { data, error } = await db
    .from('ranked_ratings')
    .select(RANK_COLUMNS)
    .eq('game', game)
    .in('user_id', ids)
    .lte('season', season)
    .order('season', { ascending: false })
    .limit(ids.length * 24);
  if (error) throw error;
  return (data ?? []) as RankedRow[];
}

/** Where each player starts a ranked table of this game from (rank, or a new season, or placement). */
export async function loadRankedStarts(
  db: SupabaseClient,
  game: string,
  ids: string[],
  season = seasonKey(),
) {
  const rows = await loadRankRows(db, game, ids, season);
  const missing = ids.filter((id) => !rows.some((r) => r.user_id === id && r.season === season));
  const elos: Record<string, number> = {};
  for (const r of await loadRatings(db, game, missing)) elos[r.user_id] = r.rating;
  return rankedStarts(ids, rows, season, elos);
}

/** My ranked points in a game, for the queue: close ranks are seated together. */
export async function rankedPoints(db: SupabaseClient, game: string, userId: string): Promise<number> {
  return (await loadRankedStarts(db, game, [userId])).get(userId)!.state.points;
}

/** People already rated at this table (they left before the end). */
async function ratedAt(db: SupabaseClient, roomId: string): Promise<Set<string>> {
  const { data, error } = await db.from('ranked_changes').select('user_id').eq('room_id', roomId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.user_id as string));
}

/** How each person looked at the table, kept for the leaderboard. */
async function looksAt(db: SupabaseClient, seats: 'game_players' | 'room_players', roomId: string) {
  const { data } = await db.from(seats).select('user_id, name, avatar, avatar_color').eq('room_id', roomId);
  const out: Record<string, { name: string; avatar: string | null; avatar_color: string | null }> = {};
  for (const p of data ?? []) {
    out[p.user_id as string] = {
      name: String(p.name ?? '').slice(0, 16),
      avatar: (p.avatar as string | null) ?? null,
      avatar_color: (p.avatar_color as string | null) ?? null,
    };
  }
  return out;
}

/**
 * Saves the rank changes of a ranked table. Each save checks nobody changed the rank meanwhile
 * (another table ending at the same moment); a player whose rank changed is read again and
 * computed again, a few times.
 */
async function saveRanked(
  db: SupabaseClient,
  room: { id: string },
  game: string,
  seats: 'game_players' | 'room_players',
  placements: Placement[],
  opts: { only?: Set<string>; forfeit?: string } = {},
) {
  const season = seasonKey();
  const looks = await looksAt(db, seats, room.id);
  let pending = new Set(opts.only ?? placements.map((p) => p.userId));
  for (let attempt = 0; attempt < 4 && pending.size > 0; attempt++) {
    const starts = await loadRankedStarts(
      db,
      game,
      placements.map((p) => p.userId),
      season,
    );
    const updates = rankedUpdates(placements, starts, { only: pending, forfeit: opts.forfeit });
    const retry = new Set<string>();
    for (const u of updates) {
      const { data, error } = await db.rpc('apply_ranked', {
        p_room: room.id,
        p_user: u.user_id,
        p_game: game,
        p_season: season,
        p_games: u.games,
        p_state: { ...u.state, ...(looks[u.user_id] ?? {}) },
        p_change: u.change,
      });
      if (error && !error.message.includes('conflict')) throw error;
      if (error || data === 'conflict') retry.add(u.user_id);
    }
    pending = retry;
  }
  if (pending.size > 0) console.error('rangs non mis à jour', [...pending]);
}

/**
 * A ranked table just ended: everyone still playing moves up or down by their place (robots never
 * count, and those who left were already rated).
 */
export async function rankTable(
  db: SupabaseClient,
  room: { id: string },
  game: string,
  placements: Placement[],
  seats: 'game_players' | 'room_players',
) {
  if (!isRankedGame(game)) return;
  try {
    const rated = await ratedAt(db, room.id);
    const people = endPlacements(placements, rated);
    if (people.length < 2) return;
    await saveRanked(db, room, game, seats, people);
  } catch (e) {
    console.error('rangs non mis à jour', e);
  }
}

/**
 * Someone abandons a ranked table: a loss, saved now. Returns whether it cost them something
 * (false when the game was already decided for them).
 */
export async function forfeitRanked(
  db: SupabaseClient,
  room: { id: string; ranked?: boolean | null },
  game: string,
  userId: string,
  humans: string[],
  seats: 'game_players' | 'room_players',
): Promise<boolean> {
  if (!room.ranked) throw new GameError('Ce n’est pas une partie classée');
  const plan = forfeitPlan(userId, humans, await ratedAt(db, room.id));
  if (!plan) return false;
  await saveRanked(db, room, game, seats, plan.placements, { only: plan.only, forfeit: userId });
  return true;
}

// ---------------------------------------------------------------------------
// My ranks and the season rewards

/** The best placed Maître rows of a game and season, for the Légende badges. */
async function topRows(db: SupabaseClient, game: string, season: string): Promise<RankedRow[]> {
  const { data, error } = await db
    .from('ranked_ratings')
    .select(RANK_COLUMNS)
    .eq('game', game)
    .eq('season', season)
    .eq('placement', 0)
    .gte('points', MASTER_POINTS)
    .order('points', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(LEGEND_TOP);
  if (error) throw error;
  return (data ?? []) as RankedRow[];
}

/** Games where this player is (or ended) among the Légende of a season. */
async function legendGamesOf(db: SupabaseClient, userId: string, rows: RankedRow[], season: string) {
  const out = new Set<string>();
  for (const game of maitreGames(rows.filter((r) => r.season === season))) {
    const top = await topRows(db, game, season);
    if (top.some((r) => r.user_id === userId)) out.add(game);
  }
  return out;
}

/**
 * "Tables classées" for the app: my rank in each game this season, and the rewards of the
 * seasons finished since my last visit, taken now (once: the database checks it).
 */
export async function rankedOverview(db: SupabaseClient, userId: string) {
  const season = seasonKey();
  const [rowsRes, claimedRes, ratingsRes] = await Promise.all([
    db
      .from('ranked_ratings')
      .select(RANK_COLUMNS)
      .eq('user_id', userId)
      .order('season', { ascending: false })
      .limit(400),
    db.from('ranked_rewards').select('season').eq('user_id', userId),
    db.from('game_ratings').select('game, rating').eq('user_id', userId),
  ]);
  for (const r of [rowsRes, claimedRes, ratingsRes]) if (r.error) throw r.error;
  const rows = (rowsRes.data ?? []) as RankedRow[];
  const elos: Record<string, number> = {};
  for (const r of ratingsRes.data ?? []) elos[r.game as string] = r.rating as number;
  const claimed = new Set((claimedRes.data ?? []).map((r) => r.season as string));

  const rewards: SeasonReward[] = [];
  for (const past of seasonsToClaim(rows, claimed, season)) {
    const reward = rewardFor(past, rows, await legendGamesOf(db, userId, rows, past));
    if (!reward) continue;
    const { data, error } = await db.rpc('claim_ranked_reward', {
      p_user: userId,
      p_season: past,
      p_tier: reward.tier,
      p_coins: reward.coins,
      p_chest: reward.chest,
      p_items: reward.items,
    });
    if (error) console.error('récompense de saison non donnée', error);
    else if (data) rewards.push(reward);
  }
  return {
    season,
    ranks: myRanks(rows, season, elos, await legendGamesOf(db, userId, rows, season)),
    rewards,
  };
}

/** The leaderboard of a game this season: the top 100 or my friends, and where I stand. */
export async function rankedBoard(db: SupabaseClient, userId: string, body: Record<string, unknown>) {
  if (!isRankedGame(body.game)) throw new GameError('Jeu inconnu');
  const game = body.game;
  const season = seasonKey();
  const friendsOnly = body.scope === 'friends';
  let ids: string[] | null = null;
  if (friendsOnly) {
    const { data, error } = await db.from('friendships').select('friend_id').eq('user_id', userId).limit(500);
    if (error) throw error;
    ids = [userId, ...(data ?? []).map((f) => f.friend_id as string)];
  }
  let q = db
    .from('ranked_ratings')
    .select(RANK_COLUMNS)
    .eq('game', game)
    .eq('season', season)
    .eq('placement', 0);
  if (ids) q = q.in('user_id', ids);
  const [listRes, top, meRes] = await Promise.all([
    q.order('points', { ascending: false }).order('updated_at', { ascending: true }).limit(100),
    topRows(db, game, season),
    db
      .from('ranked_ratings')
      .select(RANK_COLUMNS)
      .eq('user_id', userId)
      .eq('game', game)
      .eq('season', season)
      .maybeSingle(),
  ]);
  if (listRes.error) throw listRes.error;
  if (meRes.error) throw meRes.error;
  const lines = boardLines((listRes.data ?? []) as RankedRow[], top);
  const mine = meRes.data as RankedRow | null;
  let me = null;
  if (mine) {
    let position: number | null = null;
    if (mine.placement === 0) {
      const { count, error } = await db
        .from('ranked_ratings')
        .select('user_id', { count: 'exact', head: true })
        .eq('game', game)
        .eq('season', season)
        .eq('placement', 0)
        .gt('points', mine.points);
      if (error) throw error;
      position = (count ?? 0) + 1;
    }
    me = {
      points: mine.points,
      placement: mine.placement,
      games: mine.games,
      wins: mine.wins,
      legend: top.some((r) => r.user_id === userId),
      position,
    };
  }
  return { season, game, lines, me };
}
