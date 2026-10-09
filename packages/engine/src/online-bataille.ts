import type { Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import {
  type BnBoard,
  type BnPlayer,
  type BnState,
  bnBotShot,
  bnNewGame,
  bnPlace,
  bnPublicBoard,
  bnRandomFleet,
  bnShoot,
} from './bataille.ts';

/** Seat 0 is player 0 and fires first; seat 1 is player 1. */
export interface BnOnlineState {
  game: BnState;
}

/**
 * What one seat sees: its own grid in full, and of the other grid only the shots and the sunk ships.
 * `placed` tells whether each fleet is ready. Every ship is shown once the game is over.
 */
export interface BnOnlineView {
  game: BnState;
  placed: [boolean, boolean];
}

const finished = (s: BnOnlineState) => s.game.phase === 'fini';

/** Bataille navale: both players place their fleets at the same time, then fire in turn. */
export const batailleOnline: OnlineGame<BnOnlineState> = {
  minPlayers: 1,
  maxPlayers: 2,
  fillTo: 2,
  options: () => ({}),
  start(seats: OnlineSeat[]) {
    if (seats.length !== 2) throw new Error('Il faut deux joueurs');
    return { game: bnNewGame(0) };
  },
  actors(s) {
    if (s.game.phase === 'placement') return ([0, 1] as const).filter((p) => !s.game.boards[p]);
    return finished(s) ? [] : [s.game.current];
  },
  apply(s, seat, move) {
    const m = move as { type?: unknown; ships?: unknown; x?: unknown; y?: unknown } | null;
    if (finished(s)) throw new Error('La partie est finie');
    if (seat !== 0 && seat !== 1) throw new Error('Tu n’es pas à cette table');
    if (m?.type === 'place') return { game: bnPlace(s.game, seat, m.ships) };
    if (m?.type === 'shoot') {
      if (s.game.phase !== 'tir') throw new Error('Les flottes ne sont pas encore placées');
      if (seat !== s.game.current) throw new Error('Ce n’est pas ton tour.');
      if (typeof m.x !== 'number' || typeof m.y !== 'number') throw new Error('Coup inconnu.');
      return { game: bnShoot(s.game, m.x, m.y) };
    }
    throw new Error('Coup inconnu.');
  },
  auto(s, seat, rng: Rng) {
    if (s.game.phase === 'placement') return { type: 'place', ships: bnRandomFleet(rng) };
    const target = s.game.boards[seat === 0 ? 1 : 0]!;
    return { type: 'shoot', ...bnBotShot(target, 'moyen', rng) };
  },
  betweenRounds: () => false,
  nextRound() {
    throw new Error('La partie est finie.');
  },
  over: finished,
  winners: (s) => (s.game.winner === null ? [] : [s.game.winner]),
  view(s, seat): BnOnlineView {
    const { game } = s;
    const placed: [boolean, boolean] = [!!game.boards[0], !!game.boards[1]];
    if (finished(s)) return { game, placed };
    const hide = (p: BnPlayer): BnBoard | null => {
      const b = game.boards[p];
      if (!b) return null;
      return p === seat ? b : bnPublicBoard(b);
    };
    return { game: { ...game, boards: [hide(0), hide(1)] }, placed };
  },
};
