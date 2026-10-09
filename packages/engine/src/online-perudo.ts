import type { Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import {
  type PerudoMove,
  type PerudoState,
  PERUDO_MAX_PLAYERS,
  perudoApply,
  perudoBotMove,
  perudoNewGame,
  perudoNextRound,
} from './perudo.ts';

/** A die hidden under someone else's cup. */
export const PERUDO_HIDDEN = 0;

/** What a seat sees: the others' dice are hidden while a round is played, shown at the reveal. */
export type PerudoView = PerudoState;

/** Checks the shape of a move sent by a phone: nothing in it is trusted. */
function parseMove(raw: unknown): PerudoMove {
  const m = raw as { type?: unknown; quantity?: unknown; face?: unknown } | null;
  if (!m || typeof m !== 'object') throw new Error('Coup inconnu.');
  if (m.type === 'dudo' || m.type === 'calza') return { type: m.type };
  if (m.type === 'bid') {
    if (typeof m.quantity !== 'number' || typeof m.face !== 'number') throw new Error('Enchère inconnue.');
    return { type: 'bid', quantity: m.quantity, face: m.face };
  }
  throw new Error('Coup inconnu.');
}

export function perudoView(state: PerudoState, seat: number | null): PerudoView {
  if (state.phase !== 'bidding') return state;
  return {
    ...state,
    players: state.players.map((p, i) => (i === seat ? p : { ...p, dice: p.dice.map(() => PERUDO_HIDDEN) })),
  };
}

/** Perudo for 2 to 6 seats; a robot joins a player alone. */
export const perudoOnline: OnlineGame<PerudoState> = {
  minPlayers: 1,
  maxPlayers: PERUDO_MAX_PLAYERS,
  fillTo: 2,
  options(raw) {
    const calza = (raw as { calza?: unknown } | null)?.calza ?? true;
    if (typeof calza !== 'boolean') throw new Error('Option inconnue');
    return { calza };
  },
  start: (seats: OnlineSeat[], options, rng: Rng) =>
    perudoNewGame(
      seats.map((s) => ({ id: s.id, name: s.name })),
      rng,
      { calza: options.calza !== false },
    ),
  actors: (state) => (state.phase === 'bidding' ? [state.current] : []),
  apply: (state, seat, move) => perudoApply(state, seat, parseMove(move)),
  auto(state, seat, rng) {
    if (state.phase !== 'bidding') throw new Error('La manche est finie.');
    if (seat !== state.current) throw new Error('Ce n’est pas son tour.');
    return perudoBotMove(state, seat, rng);
  },
  betweenRounds: (state) => state.phase === 'reveal',
  nextRound: (state, rng) => perudoNextRound(state, rng),
  over: (state) => state.phase === 'over',
  winners: (state) => (state.winner === null ? [] : [state.winner]),
  view: perudoView,
};
