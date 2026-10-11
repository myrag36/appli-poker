// Tables classées on the server side, without any database access so it can be tested on its
// own: the rank each player starts a table from, what a finished (or abandoned) ranked table
// does to each rank, the season rewards due, and the leaderboard. The rules are in ranks.ts.
import {
  ELO_START,
  MASTER_POINTS,
  RANKED_GAME_IDS,
  type Rank,
  type RankedGameId,
  type RankedState,
  type SeasonReward,
  applyRanked,
  legendIds,
  newSeasonState,
  rankedDeltas,
  seasonBestTier,
  seasonReward,
} from '../_shared/engine/index.ts';
import type { Placement } from './rapide.ts';

/** A rank as saved: one per player, game and season. */
export interface RankedRow extends RankedState {
  user_id: string;
  game: string;
  season: string;
  name?: string | null;
  avatar?: string | null;
  avatar_color?: string | null;
  updated_at?: string;
}

/** Where a player starts a ranked table from, and the version (`games`) the save checks. */
export interface RankedStart {
  state: RankedState;
  /** Games of the saved row, or -1 when this season has no row yet. */
  games: number;
}

const stateOf = (r: RankedRow): RankedState => ({
  points: r.points,
  games: r.games,
  wins: r.wins,
  shield: r.shield,
  placement: r.placement,
  peak: r.peak,
});

/**
 * Each player's rank at the start of a table, from their rows in this game (any season up to
 * this one): this season's row, or a new season from the latest earlier one (one tier lower), or
 * placement from their casual rating.
 */
export function rankedStarts(
  ids: string[],
  rows: RankedRow[],
  season: string,
  elos: Record<string, number>,
): Map<string, RankedStart> {
  const out = new Map<string, RankedStart>();
  for (const id of ids) {
    const mine = rows.filter((r) => r.user_id === id && r.season <= season);
    const current = mine.find((r) => r.season === season);
    if (current) {
      out.set(id, { state: stateOf(current), games: current.games });
      continue;
    }
    const previous = mine.sort((a, b) => b.season.localeCompare(a.season))[0] ?? null;
    out.set(id, {
      state: newSeasonState(previous ? stateOf(previous) : null, elos[id] ?? ELO_START),
      games: -1,
    });
  }
  return out;
}

/** "or-2", "maitre": a rank in the database. */
export function rankCode(rank: Rank | null): string | null {
  if (!rank) return null;
  return rank.division ? `${rank.tier}-${rank.division}` : rank.tier;
}

/** What `apply_ranked` saves for one player. */
export interface RankedUpdate {
  user_id: string;
  /** Version read (see RankedStart). */
  games: number;
  state: RankedState;
  change: {
    delta: number;
    points_before: number;
    points_after: number;
    placement: number;
    promoted: string | null;
    demoted: string | null;
    saved: 'shield' | 'floor' | null;
    placed: boolean;
    forfeit: boolean;
  };
}

/**
 * The rank changes of a ranked table: RP from everyone's places and ranks, then the rules of the
 * ladder for each player. `only` limits the saves to some players (an abandon rates the one who
 * left, and the last opponent when only two people played); `forfeit` marks who left.
 */
export function rankedUpdates(
  placements: Placement[],
  starts: Map<string, RankedStart>,
  opts: { only?: ReadonlySet<string>; forfeit?: string } = {},
): RankedUpdate[] {
  const people = placements.filter((p) => starts.has(p.userId));
  if (people.length < 2) return [];
  const deltas = rankedDeltas(
    people.map((p) => {
      const s = starts.get(p.userId)!.state;
      return { id: p.userId, points: s.points, place: p.place, placing: s.placement > 0 };
    }),
  );
  const best = Math.min(...people.map((p) => p.place));
  const someoneLost = people.some((p) => p.place > best);
  const out: RankedUpdate[] = [];
  for (const p of people) {
    if (opts.only && !opts.only.has(p.userId)) continue;
    const start = starts.get(p.userId)!;
    const outcome = applyRanked(start.state, deltas[p.userId] ?? 0, someoneLost && p.place === best);
    out.push({
      user_id: p.userId,
      games: start.games,
      state: outcome.state,
      change: {
        delta: outcome.delta,
        points_before: start.state.points,
        points_after: outcome.state.points,
        placement: outcome.state.placement,
        promoted: rankCode(outcome.promoted),
        demoted: rankCode(outcome.demoted),
        saved: outcome.saved,
        placed: outcome.placed,
        forfeit: p.userId === opts.forfeit,
      },
    });
  }
  return out;
}

/**
 * A ranked table that just ended: everyone still to be rated (not those who left before, already
 * rated as a loss), by their place.
 */
export function endPlacements(placements: Placement[], alreadyRated: ReadonlySet<string>): Placement[] {
  return placements.filter((p) => !alreadyRated.has(p.userId));
}

/**
 * Someone leaves a ranked table before the end: a loss against everyone still playing. When only
 * one opponent is left, they are rated as the winner at once (they may leave without losing then).
 * Null when it costs nothing: already rated (the game was decided), or nobody left to lose to.
 */
export function forfeitPlan(
  leaverId: string,
  humans: string[],
  alreadyRated: ReadonlySet<string>,
): { placements: Placement[]; only: Set<string> } | null {
  const playing = humans.filter((h) => !alreadyRated.has(h));
  if (!playing.includes(leaverId) || playing.length < 2) return null;
  return {
    placements: playing.map((id) => ({ userId: id, place: id === leaverId ? 2 : 1 })),
    only: new Set(playing.length === 2 ? playing : [leaverId]),
  };
}

// ---------------------------------------------------------------------------
// My ranks, and the season rewards

/** One game's rank as the app shows it. */
export interface MyRank extends RankedState {
  game: RankedGameId;
  legend: boolean;
  /** Not played yet this season: where the first game will start (one tier lower, or placement). */
  fresh: boolean;
}

/**
 * My rank in every ranked game this season, from all my rows: this season's, or the start of the
 * season (a preview, saved at the first ranked game).
 */
export function myRanks(
  rows: RankedRow[],
  season: string,
  elos: Record<string, number>,
  legendGames: ReadonlySet<string>,
): MyRank[] {
  return RANKED_GAME_IDS.map((game) => {
    const mine = rows.filter((r) => r.game === game);
    const current = mine.find((r) => r.season === season);
    if (current) return { game, ...stateOf(current), legend: legendGames.has(game), fresh: false };
    const previous =
      mine.filter((r) => r.season < season).sort((a, b) => b.season.localeCompare(a.season))[0] ?? null;
    const state = newSeasonState(previous ? stateOf(previous) : null, elos[game] ?? ELO_START);
    return { game, ...state, legend: false, fresh: true };
  });
}

/** Finished seasons I played and have not taken the reward of yet, newest first (at most 3). */
export function seasonsToClaim(
  rows: Pick<RankedRow, 'season' | 'placement'>[],
  claimed: ReadonlySet<string>,
  current: string,
): string[] {
  const seasons = new Set(
    rows
      .filter((r) => r.season < current && r.placement === 0 && !claimed.has(r.season))
      .map((r) => r.season),
  );
  return [...seasons].sort((a, b) => b.localeCompare(a)).slice(0, 3);
}

/** Games of a finished season where a player could be Légende: they ended in Maître. */
export function maitreGames(rows: Pick<RankedRow, 'game' | 'points' | 'placement'>[]): string[] {
  return rows.filter((r) => r.placement === 0 && r.points >= MASTER_POINTS).map((r) => r.game);
}

/** The reward of a finished season, from my rows of that season and the games where I was Légende. */
export function rewardFor(
  season: string,
  rows: Pick<RankedRow, 'game' | 'peak' | 'placement' | 'season'>[],
  legendGames: ReadonlySet<string>,
): SeasonReward | null {
  const tier = seasonBestTier(
    rows.filter((r) => r.season === season),
    legendGames,
  );
  return tier ? seasonReward(season, tier) : null;
}

// ---------------------------------------------------------------------------
// The leaderboard

export interface BoardLine {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  points: number;
  games: number;
  wins: number;
  legend: boolean;
  /** 1 for the best; ties share a position. */
  position: number;
}

/**
 * Lines of a leaderboard from placed rows, best first (ties share a position). `top` are the best
 * rows of the whole game (for the Légende badges, also on the friends' board).
 */
export function boardLines(rows: RankedRow[], top: RankedRow[] = rows): BoardLine[] {
  const legends = legendIds(top);
  const placed = rows
    .filter((r) => r.placement === 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        (a.updated_at ?? '').localeCompare(b.updated_at ?? '') ||
        a.user_id.localeCompare(b.user_id),
    );
  let position = 0;
  let last = Infinity;
  return placed.map((r, i) => {
    if (r.points !== last) {
      position = i + 1;
      last = r.points;
    }
    return {
      user_id: r.user_id,
      name: r.name || 'Joueur',
      avatar: r.avatar ?? null,
      avatar_color: r.avatar_color ?? null,
      points: r.points,
      games: r.games,
      wins: r.wins,
      legend: legends.has(r.user_id),
      position,
    };
  });
}
