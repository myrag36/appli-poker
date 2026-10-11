// Partie rapide: playing online with strangers. A player waits in a queue for one game; the server
// seats waiting players of close strength together at a normal online table, so the games, timers,
// rematch and rewards work as at any other table. Each game has its own Elo rating, which only
// tables open to strangers (quick games and public tables) change.
import { ONLINE_GAMES, type OnlineGameId } from './online.ts';

/** Every game that can be found with strangers: the online games and poker. */
export type QuickGameId = OnlineGameId | 'poker';

export interface QuickGame {
  /** Table sizes a player may ask for; the first choice is what most people want. */
  sizes: number[];
  /** Size picked when the player does not choose. */
  size: number;
  /** Settings of the table: short and standard, nobody chooses them. */
  options: Record<string, unknown>;
  /** The main variant, when the game has one (poker: Hold'em or Omaha). */
  variants?: string[];
}

export const QUICK_GAMES: Record<QuickGameId, QuickGame> = {
  poker: {
    sizes: [2, 4, 6],
    size: 4,
    // A sit-and-go: the blinds go up every 5 minutes so the game ends.
    options: { bigBlind: 20, stack: 1000, levelMinutes: 5 },
    variants: ['holdem', 'omaha'],
  },
  blackjack: { sizes: [2, 3, 4], size: 2, options: { stack: 1000, rounds: 5 } },
  president: { sizes: [3, 4, 5], size: 4, options: { rounds: 3 } },
  yams: { sizes: [2, 3, 4], size: 2, options: {} },
  belote: { sizes: [4], size: 4, options: { target: 501 } },
  puissance4: { sizes: [2], size: 2, options: { rounds: 3 } },
  bataille: { sizes: [2], size: 2, options: {} },
  echecs: { sizes: [2], size: 2, options: {} },
  rami: { sizes: [2, 3, 4], size: 2, options: { target: 150 } },
  tarot: { sizes: [4], size: 4, options: { deals: 4 } },
  uno: { sizes: [2, 3, 4], size: 3, options: { target: 200 } },
  huit: { sizes: [2, 3, 4], size: 3, options: { target: 100 } },
  perudo: { sizes: [2, 3, 4], size: 3, options: { calza: true } },
  dames: { sizes: [2], size: 2, options: {} },
};

/** The quick games in the order the picker shows them: poker, then the online registry. */
export const QUICK_GAME_IDS = ['poker', ...Object.keys(ONLINE_GAMES)] as QuickGameId[];

export function isQuickGame(id: unknown): id is QuickGameId {
  return typeof id === 'string' && Object.hasOwn(QUICK_GAMES, id);
}

/** What a player asks the queue for, checked: unknown sizes and variants fall back to the defaults. */
export function quickRequest(
  game: QuickGameId,
  raw: { size?: unknown; variant?: unknown } = {},
): { game: QuickGameId; size: number; variant: string } {
  const def = QUICK_GAMES[game];
  const size = typeof raw.size === 'number' && def.sizes.includes(raw.size) ? raw.size : def.size;
  const variants = def.variants ?? [];
  const variant =
    typeof raw.variant === 'string' && variants.includes(raw.variant) ? raw.variant : (variants[0] ?? '');
  return { game, size, variant };
}

// ---------------------------------------------------------------------------
// Elo

/** Everyone starts at 1000 in each game. */
export const ELO_START = 1000;
/** Nobody falls below this. */
export const ELO_FLOOR = 100;
/** Points at stake in a duel: more for the first games, while the rating still looks for its level. */
export const ELO_K = 32;
export const ELO_K_NEW = 48;
/** Games played in a game before its rating counts as settled. */
export const ELO_NEW_GAMES = 10;

/** Chances that a player rated `a` beats one rated `b` (0 to 1). */
export function eloExpected(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

export function eloK(games: number): number {
  return games < ELO_NEW_GAMES ? ELO_K_NEW : ELO_K;
}

/** A person at a finished table: their rating before it, games played, and their place (1 = won). */
export interface EloPlayer {
  id: string;
  rating: number;
  games: number;
  place: number;
}

/**
 * Rating changes once a table ends. Each pair of people is a duel: the better place wins it, the
 * same place is a draw. With more than two people, each duel weighs K / (people - 1), so a table
 * of six moves a rating about as much as a game of chess. Robots are left out before this: a
 * table with fewer than two people changes nothing.
 */
export function eloDeltas(players: EloPlayer[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (players.length < 2) return out;
  const weight = 1 / (players.length - 1);
  for (const p of players) {
    let change = 0;
    for (const o of players) {
      if (o.id === p.id) continue;
      const score = p.place < o.place ? 1 : p.place > o.place ? 0 : 0.5;
      change += eloK(p.games) * weight * (score - eloExpected(p.rating, o.rating));
    }
    // Never below the floor; a winner always gains at least a point, a loser loses at least one.
    let delta = Math.round(change);
    const best = players.every((o) => o.id === p.id || p.place <= o.place);
    const worst = players.every((o) => o.id === p.id || p.place >= o.place);
    const alone = players.filter((o) => o.place === p.place).length === 1;
    if (alone && best && delta < 1) delta = 1;
    if (alone && worst && delta > -1) delta = -1;
    out[p.id] = Math.max(ELO_FLOOR, p.rating + delta) - p.rating;
  }
  return out;
}

/** "+12", "−8" or "±0", as shown after a game. */
export function eloDeltaLabel(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${-delta}`;
  return '±0';
}
