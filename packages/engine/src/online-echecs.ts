import type { Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import {
  type ChessMove,
  type ChessState,
  chessBotMove,
  chessNewGame,
  chessPlay,
  chessResign,
} from './echecs.ts';

/** Seat 0 plays white and starts, seat 1 plays black. Nothing is hidden. */
export interface ChessOnlineState {
  game: ChessState;
}

const finished = (s: ChessOnlineState) => s.game.result !== null;

/** Échecs: one game between two players; a robot takes the second seat if needed. */
export const echecsOnline: OnlineGame<ChessOnlineState> = {
  minPlayers: 1,
  maxPlayers: 2,
  fillTo: 2,
  options: () => ({}),
  start(seats: OnlineSeat[]) {
    if (seats.length !== 2) throw new Error('Il faut deux joueurs');
    return { game: chessNewGame() };
  },
  actors: (s) => (finished(s) ? [] : [s.game.turn]),
  apply(s, seat, move) {
    if (finished(s)) throw new Error('La partie est finie');
    if (seat !== s.game.turn) throw new Error('Ce n’est pas ton tour.');
    const m = move as { type?: unknown; from?: unknown; to?: unknown; promo?: unknown } | null;
    if (m?.type === 'resign') return { game: chessResign(s.game, s.game.turn) };
    if (m?.type !== 'move' || typeof m.from !== 'string' || typeof m.to !== 'string')
      throw new Error('Coup inconnu.');
    if (m.promo !== undefined && typeof m.promo !== 'string') throw new Error('Promotion inconnue');
    const played: ChessMove = { from: m.from, to: m.to };
    if (m.promo !== undefined) played.promo = m.promo as ChessMove['promo'];
    return { game: chessPlay(s.game, played) };
  },
  auto: (s, _seat, rng: Rng) => ({ type: 'move', ...chessBotMove(s.game, 'moyen', rng) }),
  betweenRounds: () => false,
  nextRound() {
    throw new Error('La partie est finie.');
  },
  over: finished,
  winners(s) {
    const w = s.game.result?.winner;
    return w === undefined || w === null ? [0, 1] : [w];
  },
  view: (s) => s,
};
