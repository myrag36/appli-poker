import type { Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import { type DamesState, damesBotMove, damesFinished, damesNewGame, damesPlay } from './dames.ts';

export interface DamesOnlineState {
  /** Seat 0 plays white and starts, seat 1 plays black. */
  game: DamesState;
}

/** Dames: two players, nothing hidden; a robot takes the second seat if needed. One game per table. */
export const damesOnline: OnlineGame<DamesOnlineState> = {
  minPlayers: 1,
  maxPlayers: 2,
  fillTo: 2,
  options: () => ({}),
  start(seats: OnlineSeat[]) {
    if (seats.length !== 2) throw new Error('Il faut deux joueurs');
    return { game: damesNewGame() };
  },
  actors: (s) => (damesFinished(s.game) ? [] : [s.game.current]),
  apply(s, seat, move) {
    if (damesFinished(s.game)) throw new Error('La partie est finie.');
    if (seat !== s.game.current) throw new Error('Ce n’est pas ton tour.');
    const m = move as { type?: unknown; from?: unknown; path?: unknown } | null;
    if (!m || m.type !== 'move' || typeof m.from !== 'number' || !Array.isArray(m.path))
      throw new Error('Coup inconnu.');
    if (!m.path.every((x) => typeof x === 'number')) throw new Error('Coup inconnu.');
    return { game: damesPlay(s.game, { from: m.from, path: m.path as number[] }) };
  },
  auto(s, _seat, rng: Rng) {
    const m = damesBotMove(s.game, 'moyen', rng);
    return { type: 'move', from: m.from, path: m.path };
  },
  betweenRounds: () => false,
  nextRound() {
    throw new Error('La partie se joue en une manche.');
  },
  over: (s) => damesFinished(s.game),
  winners: (s) => (s.game.winner === null ? [0, 1] : [s.game.winner]),
  view: (s) => s,
};
