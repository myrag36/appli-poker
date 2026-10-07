import type { Rng } from './cards.ts';
import {
  type BeloteMove,
  type BeloteState,
  type BeloteSuit,
  BELOTE_SUITS,
  beloteApply,
  beloteBotMove,
  beloteLegalMoves,
  beloteNewGame,
  beloteNextDeal,
  beloteView,
} from './belote.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';

/** The two lengths of game offered when creating a table. */
export const BELOTE_TARGETS = [501, 1000];

const active = (state: BeloteState) =>
  state.phase === 'bidding1' || state.phase === 'bidding2' || state.phase === 'playing';

/** Checks the shape of a move sent by a phone: nothing in it is trusted. */
function parseMove(move: unknown): BeloteMove {
  const m = move as { type?: unknown; suit?: unknown; card?: unknown } | null;
  if (!m || typeof m !== 'object') throw new Error('Coup inconnu.');
  if (m.type === 'take' || m.type === 'pass') return { type: m.type };
  if (m.type === 'choose') {
    if (typeof m.suit !== 'string' || !BELOTE_SUITS.includes(m.suit as BeloteSuit))
      throw new Error('Couleur inconnue.');
    return { type: 'choose', suit: m.suit as BeloteSuit };
  }
  if (m.type === 'play') {
    if (typeof m.card !== 'string') throw new Error('Carte inconnue.');
    return { type: 'play', card: m.card };
  }
  throw new Error('Coup inconnu.');
}

function sameMove(a: BeloteMove, b: BeloteMove): boolean {
  if (a.type === 'choose') return b.type === 'choose' && a.suit === b.suit;
  if (a.type === 'play') return b.type === 'play' && a.card === b.card;
  return a.type === b.type;
}

/**
 * Belote for exactly four seats (robots complete the table). Seats follow the engine:
 * 0 South, 1 West, 2 North, 3 East, so seats 0 and 2 play against seats 1 and 3.
 */
export const beloteOnline: OnlineGame<BeloteState> = {
  minPlayers: 1,
  maxPlayers: 4,
  fillTo: 4,
  options(raw) {
    const target = (raw as { target?: unknown } | null)?.target ?? 1000;
    if (typeof target !== 'number' || !BELOTE_TARGETS.includes(target))
      throw new Error('La partie se joue en 501 ou 1000 points.');
    return { target };
  },
  start(seats: OnlineSeat[], options, rng: Rng) {
    if (seats.length !== 4) throw new Error('La belote se joue à 4.');
    const target = BELOTE_TARGETS.includes(options.target as number) ? (options.target as number) : 1000;
    return beloteNewGame({ target, rng, dealer: rng(4) });
  },
  actors: (state) => (active(state) ? [state.toAct] : []),
  apply(state, seat, move) {
    if (!active(state)) throw new Error('Personne ne joue en ce moment.');
    if (seat !== state.toAct) throw new Error('Ce n’est pas ton tour.');
    const m = parseMove(move);
    if (!beloteLegalMoves(state).some((legal) => sameMove(legal, m))) {
      if (m.type !== 'play') throw new Error('Annonce impossible maintenant.');
      if (state.phase !== 'playing') throw new Error('Les enchères ne sont pas finies.');
      if (!state.hands[seat].includes(m.card)) throw new Error('Tu n’as pas cette carte.');
      throw new Error('Cette carte n’est pas permise.');
    }
    return beloteApply(state, seat, m);
  },
  auto(state, seat) {
    if (!active(state) || seat !== state.toAct) throw new Error('Ce n’est pas son tour.');
    return beloteBotMove(state);
  },
  betweenRounds: (state) => state.phase === 'dealOver',
  nextRound: (state, rng) => beloteNextDeal(state, rng),
  over: (state) => state.phase === 'gameOver',
  winners: (state) => (state.winner === null ? [] : [0, 1, 2, 3].filter((s) => s % 2 === state.winner)),
  view: (state, seat) => beloteView(state, seat),
};
