// Tables classées on the phone side: my ranks, the season rewards, the leaderboard, the ranks of
// the people at a ranked table and what a ranked game did to my rank. Every write goes through
// the `jeux` server; ranks are public, so the table and the leaderboard read them directly.
import { useEffect, useState } from 'react';
import {
  LEGEND_TOP,
  MASTER_POINTS,
  type RankedGameId,
  type RankedState,
  type SeasonReward,
  seasonKey,
} from '@appli-poker/engine';
import { callGames, callServer, ensureSignedIn, supabase } from './supabase';
import { refreshProgress } from './progress';

/** One game's rank as the server shows it. */
export interface MyRank extends RankedState {
  game: RankedGameId;
  legend: boolean;
  /** Not played yet this season: where the first ranked game will start. */
  fresh: boolean;
}

export interface RankedOverview {
  season: string;
  ranks: MyRank[];
  /** Rewards of finished seasons, given just now (shown once). */
  rewards: SeasonReward[];
}

export async function loadRankedOverview(): Promise<RankedOverview> {
  const out = await callGames<RankedOverview>({ type: 'ranked' });
  if (out.rewards.length > 0) refreshProgress().catch(() => {});
  return out;
}

/** My ranks, reloaded when `key` changes; null until loaded (or offline). */
export function useRankedOverview(enabled = true, key = 0) {
  const [overview, setOverview] = useState<RankedOverview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadRankedOverview().then(
      (o) => {
        if (!alive) return;
        setOverview(o);
        setFailed(false);
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [enabled, key]);
  return { overview, failed };
}

/** One line of a leaderboard. */
export interface BoardLine {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  points: number;
  games: number;
  wins: number;
  legend: boolean;
  position: number;
}

export interface RankedBoard {
  season: string;
  game: RankedGameId;
  lines: BoardLine[];
  me: {
    points: number;
    placement: number;
    games: number;
    wins: number;
    legend: boolean;
    position: number | null;
  } | null;
}

export function loadRankedBoard(game: RankedGameId, scope: 'all' | 'friends'): Promise<RankedBoard> {
  return callGames<RankedBoard>({ type: 'rankedBoard', game, scope });
}

/** Abandons a ranked table: a loss. `lost` is false when the game was already decided. */
export function forfeitRanked(game: 'poker' | string, roomId: string) {
  return game === 'poker'
    ? callServer<{ ok: true; lost: boolean }>({ type: 'forfeit', roomId })
    : callGames<{ ok: true; lost: boolean }>({ type: 'forfeit', roomId });
}

/** A rank seen at a table: hidden while placing. */
export interface SeenRank {
  points: number;
  placement: number;
  legend: boolean;
}

/** The ranks of the people at a ranked table, this season (missing: not placed yet). */
export function useRanksOf(game: string, ids: string[], enabled: boolean): Record<string, SeenRank> {
  const [ranks, setRanks] = useState<Record<string, SeenRank>>({});
  const key = ids.slice().sort().join(',');
  useEffect(() => {
    if (!enabled || ids.length === 0) return;
    let alive = true;
    const season = seasonKey();
    (async () => {
      const { data, error } = await supabase
        .from('ranked_ratings')
        .select('user_id, points, placement')
        .eq('game', game)
        .eq('season', season)
        .in('user_id', ids);
      if (error || !alive) return;
      const rows = (data ?? []) as { user_id: string; points: number; placement: number }[];
      let legends = new Set<string>();
      if (rows.some((r) => r.points >= MASTER_POINTS)) {
        const top = await supabase
          .from('ranked_ratings')
          .select('user_id')
          .eq('game', game)
          .eq('season', season)
          .eq('placement', 0)
          .gte('points', MASTER_POINTS)
          .order('points', { ascending: false })
          .order('updated_at', { ascending: true })
          .limit(LEGEND_TOP);
        legends = new Set((top.data ?? []).map((r) => r.user_id as string));
      }
      if (!alive) return;
      setRanks(
        Object.fromEntries(
          rows.map((r) => [
            r.user_id,
            { points: r.points, placement: r.placement, legend: legends.has(r.user_id) },
          ]),
        ),
      );
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, key, enabled]);
  return ranks;
}

/** What a ranked table did to my rank, as the server saved it. */
export interface RankedChange {
  delta: number;
  points_before: number;
  points_after: number;
  placement: number;
  promoted: string | null;
  demoted: string | null;
  saved: 'shield' | 'floor' | null;
  placed: boolean;
  forfeit: boolean;
}

export async function loadRankedChange(roomId: string): Promise<RankedChange | null> {
  const userId = await ensureSignedIn();
  const { data, error } = await supabase
    .from('ranked_changes')
    .select('delta, points_before, points_after, placement, promoted, demoted, saved, placed, forfeit')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as RankedChange | null) ?? null;
}

/**
 * My rank change at a ranked table, asked a few times once `active` (the server saves it right
 * after the last move, or at once when the last opponent abandons).
 */
export function useRankedChange(roomId: string, active: boolean, tries = 6): RankedChange | null {
  const [change, setChange] = useState<RankedChange | null>(null);
  useEffect(() => {
    if (!active || change) return;
    let alive = true;
    let n = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = () => {
      n++;
      loadRankedChange(roomId).then(
        (c) => {
          if (!alive) return;
          if (c) setChange(c);
          else if (n < tries) timer = setTimeout(ask, 1500);
        },
        () => alive && n < tries && (timer = setTimeout(ask, 2000)),
      );
    };
    ask();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [roomId, active, change, tries]);
  return change;
}
