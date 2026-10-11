// Tables classées: ranked games with strangers, open from level 10. Each game has its own rank,
// made of ranked points (RP) kept apart from the casual Elo rating of quick games:
//  * Bronze, Argent, Or, Platine and Diamant have three divisions (III, the lowest, then II and I)
//    of 100 RP each: reaching 100 RP promotes to the next division. Then comes Maître, with RP
//    that keep adding up, and Légende: the best Maître players of a game this season.
//  * A win earns RP and a loss costs RP, more or less depending on the opponents (the Elo maths).
//  * After a promotion, the next game is shielded: losing it cannot demote. And a loss never drops
//    a player out of a tier at once: it first stops at 0 RP in the tier's lowest division.
//  * The first games of a game are placement games: the rank stays hidden, moves fast, then shows.
//  * Ranks follow the monthly seasons: a new season starts one tier lower, and the best tier
//    reached last season brings a reward (coins, a chest, a title, frames and card backs).
// Everything is stored as one number per game and season, `points`: 300 per tier, 100 per
// division, so Bronze III 0 RP is 0, Or II 40 RP is 740 and Maître 0 RP is 1500.
import { type ChestKind } from './achievements.ts';
import { RANK_TIER_NAMES, type RankTierId, ownedKey, rankTitleId } from './progress.ts';
import { ELO_START, type QuickGameId, QUICK_GAME_IDS, eloExpected } from './quick.ts';
import { parisDay } from './quests.ts';
import { SEASONS, type Season } from './seasons.ts';

export type { RankTierId };

/** Ranked tables open at this level, checked by the server too. */
export const RANKED_LEVEL = 10;

export interface RankTier {
  id: RankTierId;
  name: string;
  /** Drawn in the middle of the emblem. */
  glyph: string;
  /** Three colors for the emblem, light to dark. */
  colors: readonly [string, string, string];
  /** The rim of the emblem and the division ribbon. */
  rim: string;
}

export const RANK_TIERS: RankTier[] = [
  {
    id: 'bronze',
    name: RANK_TIER_NAMES.bronze,
    glyph: '🛡️',
    colors: ['#f3c59a', '#b8733a', '#6e3b14'],
    rim: '#e0a46c',
  },
  {
    id: 'argent',
    name: RANK_TIER_NAMES.argent,
    glyph: '⚔️',
    colors: ['#ffffff', '#b9c1cc', '#66707d'],
    rim: '#dde3ea',
  },
  {
    id: 'or',
    name: RANK_TIER_NAMES.or,
    glyph: '👑',
    colors: ['#fff3b8', '#f2bf3a', '#9a6a08'],
    rim: '#ffe07a',
  },
  {
    id: 'platine',
    name: RANK_TIER_NAMES.platine,
    glyph: '💠',
    colors: ['#d8fff7', '#4fd1c5', '#11706a'],
    rim: '#a6f0e6',
  },
  {
    id: 'diamant',
    name: RANK_TIER_NAMES.diamant,
    glyph: '💎',
    colors: ['#e6f4ff', '#62a8ff', '#1f3f9e'],
    rim: '#b9dcff',
  },
  {
    id: 'maitre',
    name: RANK_TIER_NAMES.maitre,
    glyph: '🔮',
    colors: ['#f4dcff', '#b05cf0', '#4a1475'],
    rim: '#e2b5ff',
  },
  {
    id: 'legende',
    name: RANK_TIER_NAMES.legende,
    glyph: '🌟',
    colors: ['#fff6c9', '#ff8a3d', '#b3122e'],
    rim: '#ffd27a',
  },
];

export function rankTier(id: RankTierId): RankTier {
  return RANK_TIERS.find((x) => x.id === id)!;
}

/** Points of one division, and of a tier (three divisions). */
export const DIVISION_RP = 100;
export const TIER_POINTS = 3 * DIVISION_RP;
/** Maître starts here: five tiers of three divisions below it. */
export const MASTER_POINTS = 5 * TIER_POINTS;
/** How many of the best Maître players of a game are Légende. */
export const LEGEND_TOP = 10;
/** Ranked games played before a rank shows. */
export const PLACEMENT_GAMES = 5;
/** Placement never puts anyone above Platine III: the top is earned game by game. */
export const PLACEMENT_CAP = 3 * TIER_POINTS;
/** RP at stake in a duel of equals is half of this (20); placement games move twice as fast. */
export const RP_K = 40;
export const PLACEMENT_K = 80;
/** A lone winner earns at least this, a lone loser loses at least this. */
export const RP_MIN = 8;
/** A demotion lands this many RP into the division below. */
export const DEMOTE_RP = 75;
/** Games shielded from demotion after a promotion. */
export const SHIELD_GAMES = 1;

// ---------------------------------------------------------------------------
// Games

/**
 * Games played ranked, each at one table size (and poker in Hold'em heads-up): a rank compares
 * players, so everyone plays the same table. Left out: la Bataille, pure chance with no choice to
 * make, and Blackjack, where each player plays against the bank rather than against the others.
 */
export type RankedGameId = Exclude<QuickGameId, 'bataille' | 'blackjack'>;

export const RANKED_GAMES: Record<RankedGameId, { size: number; variant: string }> = {
  poker: { size: 2, variant: 'holdem' },
  president: { size: 4, variant: '' },
  yams: { size: 2, variant: '' },
  belote: { size: 4, variant: '' },
  puissance4: { size: 2, variant: '' },
  echecs: { size: 2, variant: '' },
  rami: { size: 2, variant: '' },
  tarot: { size: 4, variant: '' },
  uno: { size: 2, variant: '' },
  huit: { size: 2, variant: '' },
  perudo: { size: 3, variant: '' },
  dames: { size: 2, variant: '' },
};

/** Why a game has no ranked tables, as the picker explains it. */
export const RANKED_EXCLUDED: Record<Exclude<QuickGameId, RankedGameId>, string> = {
  bataille: 'Que du hasard : aucun choix à faire',
  blackjack: 'Chacun joue contre la banque, pas contre les autres',
};

/** Ranked games in the order of the quick game picker. */
export const RANKED_GAME_IDS = QUICK_GAME_IDS.filter((g) => Object.hasOwn(RANKED_GAMES, g)) as RankedGameId[];

export function isRankedGame(id: unknown): id is RankedGameId {
  return typeof id === 'string' && Object.hasOwn(RANKED_GAMES, id);
}

// ---------------------------------------------------------------------------
// Ranks

export type Division = 1 | 2 | 3;

export interface Rank {
  tier: RankTierId;
  /** III (3) is the lowest; none for Maître and Légende. */
  division: Division | null;
  /** RP within the division (0-99), or above Maître 0 RP. */
  rp: number;
}

export const DIVISION_NUMERALS: Record<Division, string> = { 1: 'I', 2: 'II', 3: 'III' };

const TIER_ORDER: RankTierId[] = RANK_TIERS.map((x) => x.id);

/** The rank of some points; `legend` when the player is among the best Maître players. */
export function rankOf(points: number, legend = false): Rank {
  const p = Math.max(0, Math.floor(points));
  if (p >= MASTER_POINTS)
    return { tier: legend ? 'legende' : 'maitre', division: null, rp: p - MASTER_POINTS };
  const tier = TIER_ORDER[Math.floor(p / TIER_POINTS)];
  const within = p % TIER_POINTS;
  return { tier, division: (3 - Math.floor(within / DIVISION_RP)) as Division, rp: within % DIVISION_RP };
}

/** "Or II", "Maître" or "Légende", in French (tier names are translated by the app). */
export function rankName(rank: Rank): string {
  const name = RANK_TIER_NAMES[rank.tier];
  return rank.division ? `${name} ${DIVISION_NUMERALS[rank.division]}` : name;
}

/** 0 for Bronze up to 6 for Légende, to compare tiers. */
export function tierIndex(tier: RankTierId): number {
  return TIER_ORDER.indexOf(tier);
}

/** Points where the division of these points starts (Maître is one long division). */
export function divisionFloor(points: number): number {
  const p = Math.max(0, Math.floor(points));
  return p >= MASTER_POINTS ? MASTER_POINTS : Math.floor(p / DIVISION_RP) * DIVISION_RP;
}

/** Points where the tier of these points starts. */
export function tierFloor(points: number): number {
  const p = Math.max(0, Math.floor(points));
  return p >= MASTER_POINTS ? MASTER_POINTS : Math.floor(p / TIER_POINTS) * TIER_POINTS;
}

/** A number for each division, going up: 0 for Bronze III … 14 for Diamant I, 15 for Maître. */
function divisionStep(points: number): number {
  return divisionFloor(points) / DIVISION_RP;
}

/** Share of the division done (0 to 1), for the RP bar; Maître fills every 100 RP. */
export function divisionProgress(points: number): number {
  const p = Math.max(0, Math.floor(points));
  return ((p >= MASTER_POINTS ? p - MASTER_POINTS : p) % DIVISION_RP) / DIVISION_RP;
}

// ---------------------------------------------------------------------------
// A player's rank in one game and season

export interface RankedState {
  /** See the top of this file; hidden while placing. */
  points: number;
  games: number;
  wins: number;
  /** Games left shielded from demotion. */
  shield: number;
  /** Placement games left (0 once placed). */
  placement: number;
  /** Highest points reached this season once placed, for the season reward. */
  peak: number;
}

/** A first ranked season in a game: placement starts from the casual rating (Elo 1000 → Argent III). */
export function placementState(elo: number = ELO_START): RankedState {
  const points = Math.max(0, Math.min(2 * TIER_POINTS, Math.round(elo - 700)));
  return { points, games: 0, wins: 0, shield: 0, placement: PLACEMENT_GAMES, peak: 0 };
}

export function isPlacing(state: Pick<RankedState, 'placement'>): boolean {
  return state.placement > 0;
}

/** A player at a finished ranked table: their points before it, and their place (1 = won). */
export interface RankedPlayer {
  id: string;
  points: number;
  place: number;
  /** Still in placement: their points move faster. */
  placing: boolean;
}

/**
 * Raw RP won or lost by each person at a finished ranked table, before the rules of the ladder
 * (shield, floors). Like the Elo of quick games: each pair is a duel, weighed 1 / (people - 1), and
 * beating someone ranked higher pays more than beating someone ranked lower.
 */
export function rankedDeltas(players: RankedPlayer[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (players.length < 2) return out;
  const weight = 1 / (players.length - 1);
  for (const p of players) {
    const k = p.placing ? PLACEMENT_K : RP_K;
    let change = 0;
    for (const o of players) {
      if (o.id === p.id) continue;
      const score = p.place < o.place ? 1 : p.place > o.place ? 0 : 0.5;
      change += k * weight * (score - eloExpected(p.points, o.points));
    }
    let delta = Math.round(change);
    const alone = players.filter((o) => o.place === p.place).length === 1;
    const best = players.every((o) => p.place <= o.place);
    const worst = players.every((o) => p.place >= o.place);
    if (alone && best) delta = Math.max(delta, RP_MIN);
    if (alone && worst) delta = Math.min(delta, -RP_MIN);
    out[p.id] = delta;
  }
  return out;
}

/** What a finished ranked game did to a player's rank. */
export interface RankedOutcome {
  state: RankedState;
  /** Change of points actually applied. */
  delta: number;
  /** The new rank after a promotion or a demotion. */
  promoted: Rank | null;
  demoted: Rank | null;
  /** A loss that did not demote: the shield after a promotion, or the floor of a tier. */
  saved: 'shield' | 'floor' | null;
  /** The last placement game: the rank shows now. */
  placed: boolean;
}

/**
 * Applies one game's raw RP (`rankedDeltas`) to a player's rank:
 *  * placement: points move freely (0 to Platine III) and the rank shows after the last game;
 *  * Bronze loses half: new players climb out of it without fear;
 *  * a loss that would leave the division stops at its floor when the shield is up, or when it
 *    would drop out of the tier with RP left (the next loss, at 0 RP, demotes);
 *  * a demotion lands at 75 RP in the division below; a promotion raises the shield.
 */
export function applyRanked(prev: RankedState, raw: number, won: boolean): RankedOutcome {
  const games = prev.games + 1;
  const wins = prev.wins + (won ? 1 : 0);
  if (prev.placement > 0) {
    const points = Math.max(0, Math.min(PLACEMENT_CAP, prev.points + raw));
    const placement = prev.placement - 1;
    return {
      state: { points, games, wins, shield: 0, placement, peak: placement === 0 ? points : prev.peak },
      delta: points - prev.points,
      promoted: null,
      demoted: null,
      saved: null,
      placed: placement === 0,
    };
  }
  const before = Math.max(0, prev.points);
  let d = raw;
  if (d < 0 && rankOf(before).tier === 'bronze') d = Math.min(-1, Math.round(d / 2));
  let after = Math.max(0, before + d);
  let saved: RankedOutcome['saved'] = null;
  const floor = divisionFloor(before);
  if (d < 0 && after < floor) {
    if (prev.shield > 0) {
      after = floor;
      saved = 'shield';
    } else if (floor === tierFloor(before) && before > floor) {
      after = floor;
      saved = 'floor';
    } else {
      after = Math.max(after, floor - (DIVISION_RP - DEMOTE_RP));
    }
  }
  const up = divisionStep(after) > divisionStep(before);
  const down = divisionStep(after) < divisionStep(before);
  return {
    state: {
      points: after,
      games,
      wins,
      shield: up ? SHIELD_GAMES : Math.max(0, prev.shield - 1),
      placement: 0,
      peak: Math.max(prev.peak, after),
    },
    delta: after - before,
    promoted: up ? rankOf(after) : null,
    demoted: down ? rankOf(after) : null,
    saved,
    placed: false,
  };
}

/** "+18 RP", "−12 RP" or "±0 RP". */
export function rpLabel(delta: number): string {
  if (delta > 0) return `+${delta} RP`;
  if (delta < 0) return `−${-delta} RP`;
  return '±0 RP';
}

// ---------------------------------------------------------------------------
// Matchmaking

/**
 * How far apart two ranked players may be (points): a division and a half at first, half a
 * division more every 15 seconds, and never more than two tiers: a ranked game stays fair.
 */
export function rankedWindow(waitedMs: number): number {
  return Math.min(2 * TIER_POINTS, 150 + 50 * Math.floor(Math.max(0, waitedMs) / 15_000));
}

// ---------------------------------------------------------------------------
// Légende and the main rank

/**
 * Légende players of one game and season: the best `LEGEND_TOP` placed Maître players (most
 * points first, the earlier one on a tie).
 */
export function legendIds(
  rows: { user_id: string; points: number; placement: number; updated_at?: string }[],
): Set<string> {
  return new Set(
    rows
      .filter((r) => r.placement === 0 && r.points >= MASTER_POINTS)
      .sort(
        (a, b) =>
          b.points - a.points ||
          (a.updated_at ?? '').localeCompare(b.updated_at ?? '') ||
          a.user_id.localeCompare(b.user_id),
      )
      .slice(0, LEGEND_TOP)
      .map((r) => r.user_id),
  );
}

/** One game's rank as shown: hidden while placing. */
export interface GameRank {
  game: RankedGameId;
  points: number;
  placement: number;
  legend?: boolean;
}

/** The "rang principal": the best rank among the games placed this season, or null. */
export function mainRank<T extends GameRank>(ranks: T[]): T | null {
  let best: T | null = null;
  for (const r of ranks) {
    if (r.placement > 0) continue;
    const score = (r.legend ? 1_000_000 : 0) + r.points;
    const bestScore = best ? (best.legend ? 1_000_000 : 0) + best.points : -1;
    if (score > bestScore) best = r;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Seasons

/** The ranked season of a Paris day: "2026-10" (the monthly season of the shop). */
export function seasonKey(day: string = parisDay()): string {
  return day.slice(0, 7);
}

export function previousSeasonKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** The theme of a ranked season (Halloween for "2026-10"). */
export function seasonOfKey(key: string): Season {
  return SEASONS[Number(key.slice(5, 7)) - 1];
}

/** Soft reset: a new season starts at the bottom of the tier below (Maître restarts in Diamant III). */
export function softReset(points: number): number {
  return Math.max(0, tierFloor(points) - TIER_POINTS);
}

/**
 * A player's rank in a game for a new season: one tier below where the last season they played
 * ended, or placement (from the casual rating) when they never finished placing in this game.
 */
export function newSeasonState(prev: RankedState | null, elo: number = ELO_START): RankedState {
  if (!prev || prev.placement > 0) return placementState(elo);
  const points = softReset(prev.points);
  return { points, games: 0, wins: 0, shield: 0, placement: 0, peak: points };
}

/** What a season ending in a tier brings, the title "Or — Saison Automne" aside. */
export const SEASON_REWARDS: Record<
  RankTierId,
  { coins: number; chest: ChestKind | null; frame?: string; cardBack?: string }
> = {
  bronze: { coins: 100, chest: null },
  argent: { coins: 200, chest: 'normal' },
  or: { coins: 350, chest: 'normal', frame: 'classe-or' },
  platine: { coins: 500, chest: 'grand', frame: 'classe-platine' },
  diamant: { coins: 800, chest: 'grand', frame: 'classe-diamant', cardBack: 'classe-diamant' },
  maitre: { coins: 1200, chest: 'grand', frame: 'classe-maitre', cardBack: 'classe-maitre' },
  legende: { coins: 2000, chest: 'grand', frame: 'classe-legende', cardBack: 'classe-legende' },
};

export interface SeasonReward {
  season: string;
  tier: RankTierId;
  coins: number;
  chest: ChestKind | null;
  /** Items for the collection, as stored (`title:classe-or-11`). */
  items: string[];
}

/** The reward of a season finished in a tier. */
export function seasonReward(season: string, tier: RankTierId): SeasonReward {
  const r = SEASON_REWARDS[tier];
  const items = [ownedKey('title', rankTitleId(tier, Number(season.slice(5, 7))))];
  if (r.frame) items.push(ownedKey('frame', r.frame));
  if (r.cardBack) items.push(ownedKey('cardBack', r.cardBack));
  return { season, tier, coins: r.coins, chest: r.chest, items };
}

/**
 * The best tier a player reached in a season, over all games: the peak of each game placed, or
 * Légende for a game where they ended among the best. Null when nothing was placed.
 */
export function seasonBestTier(
  rows: { game: string; peak: number; placement: number }[],
  legendGames: ReadonlySet<string> = new Set(),
): RankTierId | null {
  let best: RankTierId | null = null;
  for (const r of rows) {
    if (r.placement > 0) continue;
    const tier = legendGames.has(r.game) ? 'legende' : rankOf(r.peak).tier;
    if (best === null || tierIndex(tier) > tierIndex(best)) best = tier;
  }
  return best;
}
