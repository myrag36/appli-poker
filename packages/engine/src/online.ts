// Shared shape of the games played online (except poker, which has its own server).
// The server keeps the full state secret and sends each player only `view(state, seat)`.
import type { Rng } from './cards.ts';
import { blackjackOnline } from './online-blackjack.ts';
import { beloteOnline } from './online-belote.ts';
import { presidentOnline } from './online-president.ts';
import { puissance4Online } from './online-puissance4.ts';
import { yamsOnline } from './online-yams.ts';
import { tarotOnline } from './online-tarot.ts';

import { ramiOnline } from './online-rami.ts';

import { huitOnlineGame, unoOnlineGame } from './online-uno.ts';

export type OnlineGameId =
  | 'blackjack'
  | 'president'
  | 'yams'
  | 'belote'
  | 'puissance4'
  | 'rami'
  | 'tarot'
  | 'uno'
  | 'huit';

/** A seat at an online table, in seat order. Robots are played by the server. */
export interface OnlineSeat {
  id: string;
  name: string;
  bot: boolean;
}

export interface OnlineGame<S = any> {
  minPlayers: number;
  maxPlayers: number;
  /** Robots added at the start until the table has this many seats (Belote needs exactly 4). */
  fillTo?: number;
  /** Checks and normalizes the options chosen when creating the table. */
  options(raw: unknown): Record<string, unknown>;
  start(seats: OnlineSeat[], options: Record<string, unknown>, rng: Rng): S;
  /** Seats that may move now; empty between rounds or at the end. */
  actors(state: S): number[];
  /**
   * Seats whose turn it really is, told on their phone; `actors` when missing. Uno lets everyone
   * catch a forgotten announcement, but only the current player is waited for.
   */
  toPlay?(state: S): number[];
  /** Plays a move for a seat; throws an Error with a French message when it is not allowed. */
  apply(state: S, seat: number, move: unknown, rng: Rng): S;
  /** A sensible move for a seat: used for robots and for players who let their time run out. */
  auto(state: S, seat: number, rng: Rng): unknown;
  /** True when a round is over and the table waits for someone to start the next one. */
  betweenRounds(state: S): boolean;
  nextRound(state: S, rng: Rng): S;
  over(state: S): boolean;
  /** Seats that won, once the game is over (a whole team at Belote). */
  winners(state: S): number[];
  /** What one seat may see (null: a spectator). Hidden cards must be removed here. */
  view(state: S, seat: number | null): unknown;
}

export const ONLINE_GAMES: Record<OnlineGameId, OnlineGame> = {
  blackjack: blackjackOnline,
  president: presidentOnline,
  yams: yamsOnline,
  belote: beloteOnline,
  puissance4: puissance4Online,
  rami: ramiOnline,
  tarot: tarotOnline,
  uno: unoOnlineGame,
  huit: huitOnlineGame,
};

export function isOnlineGame(id: unknown): id is OnlineGameId {
  return typeof id === 'string' && Object.hasOwn(ONLINE_GAMES, id);
}

export {
  type P4OnlineState,
  P4_ONLINE_DEFAULT_ROUNDS,
  P4_ONLINE_ROUND_CHOICES,
} from './online-puissance4.ts';

/** Robot names for the seats the server fills itself. */
export const ONLINE_BOT_NAMES = ['Robby', 'Bip', 'Zorg', 'Tina', 'Max', 'Nova', 'Pixel'];
