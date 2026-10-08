import type { Card, Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import {
  type TarotBid,
  type TarotMove,
  type TarotState,
  TAROT_CONTRACTS,
  tarotApply,
  tarotBotMove,
  tarotLegalMoves,
  tarotNewGame,
  tarotNextDeal,
  tarotView,
} from './tarot.ts';

/** The two lengths of game offered when creating a table: everyone deals once, or twice. */
export const TAROT_DEAL_COUNTS = [4, 8];

const active = (state: TarotState) =>
  state.phase === 'bidding' || state.phase === 'ecart' || state.phase === 'playing';

/** Checks the shape of a move sent by a phone: nothing in it is trusted. */
function parseMove(move: unknown): TarotMove {
  const m = move as { type?: unknown; bid?: unknown; cards?: unknown; card?: unknown } | null;
  if (!m || typeof m !== 'object') throw new Error('Coup inconnu.');
  if (m.type === 'bid') {
    if (m.bid !== 'pass' && !(TAROT_CONTRACTS as unknown[]).includes(m.bid))
      throw new Error('Annonce inconnue.');
    return { type: 'bid', bid: m.bid as TarotBid };
  }
  if (m.type === 'ecart') {
    if (!Array.isArray(m.cards) || m.cards.length > 6 || !m.cards.every((c) => typeof c === 'string'))
      throw new Error('Il faut écarter 6 cartes');
    return { type: 'ecart', cards: m.cards as Card[] };
  }
  if (m.type === 'play') {
    if (typeof m.card !== 'string') throw new Error('Carte inconnue.');
    return { type: 'play', card: m.card };
  }
  throw new Error('Coup inconnu.');
}

/**
 * Tarot for exactly four seats (robots complete the table): at each deal, one taker against the
 * three others. Seats follow the engine's playing order.
 */
export const tarotOnline: OnlineGame<TarotState> = {
  minPlayers: 1,
  maxPlayers: 4,
  fillTo: 4,
  options(raw) {
    const deals = (raw as { deals?: unknown } | null)?.deals ?? 4;
    if (typeof deals !== 'number' || !TAROT_DEAL_COUNTS.includes(deals))
      throw new Error('La partie se joue en 4 ou 8 donnes.');
    return { deals };
  },
  start(seats: OnlineSeat[], options, rng: Rng) {
    if (seats.length !== 4) throw new Error('Le tarot se joue à 4.');
    const deals = TAROT_DEAL_COUNTS.includes(options.deals as number) ? (options.deals as number) : 4;
    return tarotNewGame({ deals, rng, dealer: rng(4) });
  },
  actors: (state) => (active(state) ? [state.toAct] : []),
  apply(state, seat, move) {
    if (!active(state)) throw new Error('Personne ne joue en ce moment.');
    if (seat !== state.toAct) throw new Error('Ce n’est pas ton tour.');
    const m = parseMove(move);
    if (state.phase === 'bidding' && m.type === 'bid') {
      if (!tarotLegalMoves(state).some((l) => l.type === 'bid' && l.bid === m.bid))
        throw new Error('Il faut annoncer plus haut ou passer');
    }
    // The engine checks the rest: the phase, the écart and the cards that may be played.
    return tarotApply(state, seat, m);
  },
  auto(state, seat) {
    if (!active(state) || seat !== state.toAct) throw new Error('Ce n’est pas son tour.');
    return tarotBotMove(state);
  },
  betweenRounds: (state) => state.phase === 'dealOver',
  nextRound: (state, rng) => tarotNextDeal(state, rng),
  over: (state) => state.phase === 'gameOver',
  winners: (state) => state.winners ?? [],
  view: (state, seat) => tarotView(state, seat),
};
