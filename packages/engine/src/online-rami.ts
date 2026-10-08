import type { Card, Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import {
  type RamiMove,
  type RamiState,
  ramiApply,
  ramiBotMove,
  ramiNewGame,
  ramiNextRound,
  ramiRanking,
  ramiView,
} from './rami.ts';

/** The lengths of game offered when creating a table. */
export const RAMI_TARGETS = [150, 300, 500];

const active = (state: RamiState) => state.phase === 'draw' || state.phase === 'play';

const isCard = (c: unknown): c is Card => typeof c === 'string' && c.length === 3;

function cardList(raw: unknown): Card[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 14 || !raw.every(isCard))
    throw new Error('Choisis des cartes de ta main.');
  return [...raw];
}

/** Checks the shape of a move sent by a phone: nothing in it is trusted. */
function parseMove(move: unknown): RamiMove {
  const m = move as {
    type?: unknown;
    melds?: unknown;
    meld?: unknown;
    cards?: unknown;
    card?: unknown;
  } | null;
  if (!m || typeof m !== 'object') throw new Error('Coup inconnu.');
  if (m.type === 'draw' || m.type === 'take') return { type: m.type };
  if (m.type === 'discard') {
    if (!isCard(m.card)) throw new Error('Carte inconnue.');
    return { type: 'discard', card: m.card };
  }
  if (m.type === 'meld') {
    if (!Array.isArray(m.melds) || m.melds.length === 0 || m.melds.length > 5)
      throw new Error('Choisis des cartes de ta main.');
    return { type: 'meld', melds: m.melds.map(cardList) };
  }
  if (m.type === 'add' || m.type === 'swap') {
    if (typeof m.meld !== 'number' || !Number.isInteger(m.meld)) throw new Error('Combinaison introuvable');
    if (m.type === 'add') return { type: 'add', meld: m.meld, cards: cardList(m.cards) };
    if (!isCard(m.card)) throw new Error('Carte inconnue.');
    return { type: 'swap', meld: m.meld, card: m.card };
  }
  throw new Error('Coup inconnu.');
}

/** Rami for 2 to 6 seats: a robot joins a player left alone. Each one sees only their own hand. */
export const ramiOnline: OnlineGame<RamiState> = {
  minPlayers: 1,
  maxPlayers: 6,
  fillTo: 2,
  options(raw) {
    const target = (raw as { target?: unknown } | null)?.target ?? 300;
    if (typeof target !== 'number' || !RAMI_TARGETS.includes(target))
      throw new Error('La partie se joue en 150, 300 ou 500 points.');
    return { target };
  },
  start(seats: OnlineSeat[], options, rng: Rng) {
    const target = RAMI_TARGETS.includes(options.target as number) ? (options.target as number) : 300;
    return ramiNewGame({
      players: seats.map((s) => ({ name: s.name, bot: s.bot })),
      target,
      rng,
      dealer: rng(seats.length),
    });
  },
  actors: (state) => (active(state) ? [state.current] : []),
  apply(state, seat, move, rng) {
    if (!active(state)) throw new Error('Personne ne joue en ce moment.');
    if (seat !== state.current) throw new Error('Ce n’est pas ton tour.');
    return ramiApply(state, parseMove(move), rng);
  },
  auto(state, seat) {
    if (!active(state) || seat !== state.current) throw new Error('Ce n’est pas son tour.');
    return ramiBotMove(state);
  },
  betweenRounds: (state) => state.phase === 'roundOver',
  nextRound: (state, rng) => ramiNextRound(state, rng),
  over: (state) => state.phase === 'gameOver',
  winners: (state) =>
    ramiRanking(state)
      .filter((r) => r.place === 1)
      .map((r) => r.player),
  view: (state, seat) => ramiView(state, seat),
};
