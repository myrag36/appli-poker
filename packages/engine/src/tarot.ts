import { type Card, type Rng, secureRng, shuffle } from './cards.ts';

/**
 * French Tarot for four players: one taker against the three others.
 * Seats go round the table in playing order: 0 = South, 1 = West, 2 = North, 3 = East.
 *
 * Cards are strings:
 * - suit cards are the rank then the suit: "1s" … "10s", "Vs" (valet), "Cs" (cavalier), "Ds" (dame), "Rs" (roi);
 * - trumps (atouts) are their number then "t": "1t" (the Petit) … "21t";
 * - the Excuse is "EX".
 */

export type TarotSuit = 's' | 'h' | 'd' | 'c';
export const TAROT_SUITS: TarotSuit[] = ['s', 'h', 'd', 'c'];
export const TAROT_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'C', 'D', 'R'];
export const TAROT_SUIT_SYMBOLS: Record<TarotSuit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const TAROT_SUIT_NAMES: Record<TarotSuit, string> = {
  s: 'pique',
  h: 'cœur',
  d: 'carreau',
  c: 'trèfle',
};

export const TAROT_PETIT = '1t';
export const TAROT_MONDE = '21t';
export const TAROT_EXCUSE = 'EX';
export const TAROT_OUDLERS: Card[] = [TAROT_PETIT, TAROT_MONDE, TAROT_EXCUSE];

export type TarotContract = 'petite' | 'garde' | 'gardeSans' | 'gardeContre';
export type TarotBid = 'pass' | TarotContract;
/** Contracts from the weakest to the strongest. */
export const TAROT_CONTRACTS: TarotContract[] = ['petite', 'garde', 'gardeSans', 'gardeContre'];
export const TAROT_CONTRACT_NAMES: Record<TarotContract, string> = {
  petite: 'Petite',
  garde: 'Garde',
  gardeSans: 'Garde sans',
  gardeContre: 'Garde contre',
};
export const TAROT_MULTIPLIERS: Record<TarotContract, number> = {
  petite: 1,
  garde: 2,
  gardeSans: 4,
  gardeContre: 6,
};
/** Points the taker needs, by number of oudlers won (0 to 3). */
export const TAROT_TARGETS = [56, 51, 41, 36];

export interface TarotPlayedCard {
  player: number;
  card: Card;
}

export type TarotMove =
  | { type: 'bid'; bid: TarotBid }
  | { type: 'ecart'; cards: Card[] }
  | { type: 'play'; card: Card };

/** Camp 0 is the taker, camp 1 the defence. */
export type TarotCamp = 0 | 1;

export type TarotDealResult =
  | { kind: 'redeal'; reason: 'allPass' }
  | { kind: 'redeal'; reason: 'petitSec'; player: number }
  | {
      kind: 'played';
      taker: number;
      contract: TarotContract;
      /** Oudlers won by the taker. */
      oudlers: number;
      /** Card points won by the taker (out of 91, may end in .5). */
      points: number;
      /** Points the taker needed. */
      target: number;
      made: boolean;
      /** Points above or below the target, rounded. */
      gap: number;
      /** Camp that won the last trick with the Petit in it, if any. */
      petitAuBout: TarotCamp | null;
      /** What the taker wins (or loses, if negative) from each defender. */
      perDefender: number;
      /** What each seat adds to its score for this deal (sums to zero). */
      dealScores: number[];
    };

export interface TarotState {
  phase: 'bidding' | 'ecart' | 'playing' | 'dealOver' | 'gameOver';
  /** Played deals in the whole game. */
  deals: number;
  /** Number of the current deal (redeals do not count). */
  dealNumber: number;
  dealer: number;
  scores: number[];
  hands: Card[][];
  /** The six cards of the chien, as dealt. */
  chien: Card[];
  /** Seat whose turn it is, or -1 when nobody has to act. */
  toAct: number;
  bids: { player: number; bid: TarotBid }[];
  contract: TarotContract | null;
  taker: number | null;
  /** The taker's discard; only the taker may see it, except for the trumps in it. */
  ecart: Card[];
  trick: TarotPlayedCard[];
  lastTrick: { cards: TarotPlayedCard[]; winner: number } | null;
  /** Every finished trick of the deal, in order. */
  tricks: { cards: TarotPlayedCard[]; winner: number }[];
  /** Cards won by each camp (0 taker, 1 defence), the chien or écart included. */
  won: [Card[], Card[]];
  /** Half points moved by the Excuse exchange. */
  adjust: [number, number];
  tricksWon: [number, number];
  result: TarotDealResult | null;
  /** Seats with the best score once the game is over. */
  winners: number[] | null;
}

// ---------------------------------------------------------------- Cards

export function tarotNewDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of TAROT_SUITS) for (const r of TAROT_RANKS) deck.push(r + s);
  for (let n = 1; n <= 21; n++) deck.push(`${n}t`);
  deck.push(TAROT_EXCUSE);
  return deck;
}

export function tarotIsTrump(card: Card): boolean {
  return card !== TAROT_EXCUSE && card.endsWith('t');
}

/** 's', 'h', 'd', 'c', 't' for trumps, 'x' for the Excuse. */
export function tarotSuitOf(card: Card): string {
  return card === TAROT_EXCUSE ? 'x' : card.slice(-1);
}

export function tarotRankOf(card: Card): string {
  return card === TAROT_EXCUSE ? '' : card.slice(0, -1);
}

/** Strength within its own suit: 1 to 14 for suit cards, 1 to 21 for trumps, 0 for the Excuse. */
export function tarotValue(card: Card): number {
  if (card === TAROT_EXCUSE) return 0;
  if (tarotIsTrump(card)) return Number(card.slice(0, -1));
  return TAROT_RANKS.indexOf(card.slice(0, -1)) + 1;
}

export function tarotIsOudler(card: Card): boolean {
  return TAROT_OUDLERS.includes(card);
}

/** Card points: oudlers and kings 4.5, queens 3.5, cavaliers 2.5, valets 1.5, the others 0.5. */
export function tarotPoints(card: Card): number {
  if (tarotIsOudler(card)) return 4.5;
  if (tarotIsTrump(card)) return 0.5;
  switch (tarotRankOf(card)) {
    case 'R':
      return 4.5;
    case 'D':
      return 3.5;
    case 'C':
      return 2.5;
    case 'V':
      return 1.5;
    default:
      return 0.5;
  }
}

export function tarotCountPoints(cards: Card[]): number {
  return cards.reduce((s, c) => s + tarotPoints(c), 0);
}

const SORT_SUITS = ['x', 't', 's', 'h', 'c', 'd'];

/** Excuse and trumps first, then the suits alternating colours, each from low to high. */
export function tarotSortHand(hand: Card[]): Card[] {
  return hand
    .slice()
    .sort(
      (a, b) =>
        SORT_SUITS.indexOf(tarotSuitOf(a)) - SORT_SUITS.indexOf(tarotSuitOf(b)) ||
        tarotValue(a) - tarotValue(b),
    );
}

/** The suit asked in a trick: that of its first card other than the Excuse. */
export function tarotLedSuit(trick: TarotPlayedCard[]): string | null {
  const first = trick.find((p) => p.card !== TAROT_EXCUSE);
  return first ? tarotSuitOf(first.card) : null;
}

/** Index in `trick` of the card currently winning it (the Excuse never wins). */
export function tarotTrickWinnerIndex(trick: TarotPlayedCard[]): number {
  const led = tarotLedSuit(trick);
  let best = -1;
  for (let i = 0; i < trick.length; i++) {
    const c = trick[i].card;
    if (c === TAROT_EXCUSE) continue;
    if (best < 0) {
      best = i;
      continue;
    }
    const b = trick[best].card;
    const cTrump = tarotIsTrump(c);
    const bTrump = tarotIsTrump(b);
    if (cTrump && !bTrump) best = i;
    else if (cTrump === bTrump && tarotSuitOf(c) === tarotSuitOf(b) && tarotValue(c) > tarotValue(b))
      best = i;
    else if (!cTrump && !bTrump && tarotSuitOf(c) === led && tarotSuitOf(b) !== led) best = i;
  }
  return best < 0 ? 0 : best;
}

/** Cards that may be played from `hand` on the current `trick`. */
export function tarotLegalCards(hand: Card[], trick: TarotPlayedCard[]): Card[] {
  const led = tarotLedSuit(trick);
  if (led === null) return hand.slice();
  const withExcuse = (cards: Card[]) =>
    hand.includes(TAROT_EXCUSE) && !cards.includes(TAROT_EXCUSE) ? [...cards, TAROT_EXCUSE] : cards;
  const trumps = hand.filter(tarotIsTrump);
  const highest = trick
    .filter((p) => tarotIsTrump(p.card))
    .reduce((m, p) => Math.max(m, tarotValue(p.card)), 0);
  const over = trumps.filter((c) => tarotValue(c) > highest);
  const mustTrump = () => withExcuse(over.length > 0 ? over : trumps);
  if (led === 't') return trumps.length > 0 ? mustTrump() : hand.slice();
  const following = hand.filter((c) => tarotSuitOf(c) === led);
  if (following.length > 0) return withExcuse(following);
  if (trumps.length > 0) return mustTrump();
  return hand.slice();
}

/** Cards the taker is never allowed to put in the écart. */
function neverInEcart(card: Card): boolean {
  return tarotIsOudler(card) || tarotRankOf(card) === 'R';
}

/**
 * Whether `cards` is a valid écart from `hand`: six of its cards, no king nor oudler, and trumps only when
 * there are not enough other cards (all of those must then be discarded).
 */
export function tarotEcartError(hand: Card[], cards: Card[]): string | null {
  if (cards.length !== 6) return 'Il faut écarter 6 cartes';
  if (new Set(cards).size !== 6 || !cards.every((c) => hand.includes(c))) return 'Tu n’as pas ces cartes';
  if (cards.some((c) => tarotRankOf(c) === 'R' && !tarotIsTrump(c))) return 'On n’écarte pas de roi';
  if (cards.some(tarotIsOudler)) return 'On n’écarte pas de bout';
  const plain = hand.filter((c) => !tarotIsTrump(c) && !neverInEcart(c));
  if (cards.some(tarotIsTrump)) {
    if (plain.length >= 6) return 'On n’écarte pas d’atout';
    if (!plain.every((c) => cards.includes(c))) return 'Écarte d’abord toutes tes autres cartes';
  }
  return null;
}

/** Cards the taker may pick for the écart (trumps only if the others are not enough). */
export function tarotEcartCandidates(hand: Card[]): Card[] {
  const plain = hand.filter((c) => !tarotIsTrump(c) && !neverInEcart(c));
  if (plain.length >= 6) return plain;
  return [...plain, ...hand.filter((c) => tarotIsTrump(c) && !neverInEcart(c))];
}

export function tarotLegalMoves(state: TarotState): TarotMove[] {
  if (state.phase === 'bidding') {
    const best = highestBid(state.bids);
    return [
      { type: 'bid', bid: 'pass' },
      ...TAROT_CONTRACTS.filter((c) => contractRank(c) > contractRank(best)).map((bid) => ({
        type: 'bid' as const,
        bid,
      })),
    ];
  }
  if (state.phase === 'playing') {
    return tarotLegalCards(state.hands[state.toAct], state.trick).map((card) => ({
      type: 'play' as const,
      card,
    }));
  }
  // The écart has too many possibilities to list; tarotEcartError checks one.
  return [];
}

function contractRank(c: TarotContract | null): number {
  return c === null ? -1 : TAROT_CONTRACTS.indexOf(c);
}

function highestBid(bids: { bid: TarotBid }[]): TarotContract | null {
  let best: TarotContract | null = null;
  for (const b of bids) if (b.bid !== 'pass' && contractRank(b.bid) > contractRank(best)) best = b.bid;
  return best;
}

export function tarotCampOf(player: number, taker: number | null): TarotCamp {
  return player === taker ? 0 : 1;
}

// ---------------------------------------------------------------- Deal

export interface TarotDealOptions {
  dealer: number;
  deals?: number;
  dealNumber?: number;
  scores?: number[];
  rng?: Rng;
  /** Already shuffled 78 cards, for tests. */
  deck?: Card[];
}

/** Has the Petit as only trump, without the Excuse: the deal is cancelled. */
export function tarotPetitSec(hand: Card[]): boolean {
  return hand.includes(TAROT_PETIT) && !hand.includes(TAROT_EXCUSE) && hand.filter(tarotIsTrump).length === 1;
}

/** Deals 3 cards at a time, starting after the dealer, with one card for the chien after each of the first rounds. */
export function tarotStartDeal(opts: TarotDealOptions): TarotState {
  const deck = opts.deck ? opts.deck.slice() : shuffle(tarotNewDeck(), opts.rng ?? secureRng);
  if (deck.length !== 78 || new Set(deck).size !== 78) throw new Error('Paquet de 78 cartes invalide');
  const hands: Card[][] = [[], [], [], []];
  const chien: Card[] = [];
  let k = 0;
  for (let round = 0; round < 6; round++) {
    for (let i = 1; i <= 4; i++) {
      const p = (opts.dealer + i) % 4;
      for (let c = 0; c < 3; c++) hands[p].push(deck[k++]);
    }
    chien.push(deck[k++]);
  }
  const state: TarotState = {
    phase: 'bidding',
    deals: opts.deals ?? 4,
    dealNumber: opts.dealNumber ?? 1,
    dealer: opts.dealer,
    scores: opts.scores ? opts.scores.slice() : [0, 0, 0, 0],
    hands: hands.map(tarotSortHand),
    chien,
    toAct: (opts.dealer + 1) % 4,
    bids: [],
    contract: null,
    taker: null,
    ecart: [],
    trick: [],
    lastTrick: null,
    tricks: [],
    won: [[], []],
    adjust: [0, 0],
    tricksWon: [0, 0],
    result: null,
    winners: null,
  };
  for (let i = 1; i <= 4; i++) {
    const p = (opts.dealer + i) % 4;
    if (tarotPetitSec(state.hands[p]))
      return {
        ...state,
        phase: 'dealOver',
        toAct: -1,
        result: { kind: 'redeal', reason: 'petitSec', player: p },
      };
  }
  return state;
}

export function tarotNewGame(opts: {
  deals?: number;
  dealer?: number;
  rng?: Rng;
  deck?: Card[];
}): TarotState {
  return tarotStartDeal({ dealer: opts.dealer ?? 3, deals: opts.deals, rng: opts.rng, deck: opts.deck });
}

/** Starts the next deal (after a played deal or a redeal), with the next dealer. */
export function tarotNextDeal(state: TarotState, rng: Rng = secureRng, deck?: Card[]): TarotState {
  if (state.phase !== 'dealOver') throw new Error('La donne n’est pas finie');
  return tarotStartDeal({
    dealer: (state.dealer + 1) % 4,
    deals: state.deals,
    dealNumber: state.result?.kind === 'played' ? state.dealNumber + 1 : state.dealNumber,
    scores: state.scores,
    rng,
    deck,
  });
}

function startPlay(state: TarotState): TarotState {
  return { ...state, phase: 'playing', toAct: (state.dealer + 1) % 4 };
}

export function tarotApply(state: TarotState, player: number, move: TarotMove): TarotState {
  if (player !== state.toAct) throw new Error('Ce n’est pas ton tour');

  if (state.phase === 'bidding') {
    if (move.type !== 'bid') throw new Error('C’est le moment des enchères');
    const best = highestBid(state.bids);
    if (
      move.bid !== 'pass' &&
      (!TAROT_CONTRACTS.includes(move.bid) || contractRank(move.bid) <= contractRank(best))
    )
      throw new Error('Il faut annoncer plus haut ou passer');
    const bids = [...state.bids, { player, bid: move.bid }];
    if (bids.length < 4) return { ...state, bids, toAct: (player + 1) % 4 };
    const contract = highestBid(bids);
    if (contract === null)
      return { ...state, bids, phase: 'dealOver', toAct: -1, result: { kind: 'redeal', reason: 'allPass' } };
    const taker = bids.find((b) => b.bid === contract)!.player;
    const next: TarotState = { ...state, bids, contract, taker };
    if (contract === 'gardeSans') return startPlay({ ...next, won: [state.chien.slice(), []] });
    if (contract === 'gardeContre') return startPlay({ ...next, won: [[], state.chien.slice()] });
    // Petite or garde: the chien is shown, then the taker takes it and makes the écart.
    const hands = state.hands.map((h, i) => (i === taker ? tarotSortHand([...h, ...state.chien]) : h));
    return { ...next, hands, phase: 'ecart', toAct: taker };
  }

  if (state.phase === 'ecart') {
    if (move.type !== 'ecart') throw new Error('Le preneur doit faire son écart');
    const hand = state.hands[player];
    const error = tarotEcartError(hand, move.cards);
    if (error) throw new Error(error);
    const hands = state.hands.map((h, i) => (i === player ? h.filter((c) => !move.cards.includes(c)) : h));
    return startPlay({ ...state, hands, ecart: move.cards.slice(), won: [move.cards.slice(), []] });
  }

  if (state.phase !== 'playing' || move.type !== 'play') throw new Error('Coup impossible maintenant');
  const hand = state.hands[player];
  if (!hand.includes(move.card)) throw new Error('Tu n’as pas cette carte');
  if (!tarotLegalCards(hand, state.trick).includes(move.card))
    throw new Error('Cette carte n’est pas permise');

  const hands = state.hands.map((h, i) => (i === player ? h.filter((c) => c !== move.card) : h));
  const trick = [...state.trick, { player, card: move.card }];
  if (trick.length < 4) return { ...state, hands, trick, toAct: (player + 1) % 4 };

  const taker = state.taker!;
  const camp = (p: number) => tarotCampOf(p, taker);
  const last = hands[0].length === 0;
  let winner = trick[tarotTrickWinnerIndex(trick)].player;
  const excuse = trick.find((p) => p.card === TAROT_EXCUSE);
  // A camp that won every trick and leads the Excuse to the last one wins it (chelem).
  if (last && excuse && trick[0].card === TAROT_EXCUSE && state.tricksWon[1 - camp(excuse.player)] === 0)
    winner = excuse.player;
  const winCamp = camp(winner);
  const won: [Card[], Card[]] = [state.won[0].slice(), state.won[1].slice()];
  const adjust: [number, number] = [...state.adjust];
  for (const p of trick) {
    const own = camp(p.player);
    if (p.card === TAROT_EXCUSE && own !== winCamp && !last) {
      // The Excuse stays with its camp, which gives a half-point card in exchange.
      won[own].push(TAROT_EXCUSE);
      adjust[own] -= 0.5;
      adjust[winCamp] += 0.5;
    } else {
      won[winCamp].push(p.card);
    }
  }
  const tricksWon: [number, number] = [...state.tricksWon];
  tricksWon[winCamp]++;
  const done = { cards: trick, winner };
  const next: TarotState = {
    ...state,
    hands,
    trick: [],
    lastTrick: done,
    tricks: [...state.tricks, done],
    toAct: winner,
    won,
    adjust,
    tricksWon,
  };
  return last ? scoreDeal(next) : next;
}

// ---------------------------------------------------------------- Score

/**
 * Score of a deal: (25 + gap) × contract multiplier, plus or minus 10 × multiplier for the Petit au bout.
 * The taker wins (or pays) that much from each of the three defenders.
 */
export function tarotScore(
  taker: number,
  contract: TarotContract,
  points: number,
  oudlers: number,
  petitAuBout: TarotCamp | null,
): Extract<TarotDealResult, { kind: 'played' }> {
  const target = TAROT_TARGETS[oudlers];
  const made = points >= target;
  const gap = Math.round(Math.abs(points - target));
  const mult = TAROT_MULTIPLIERS[contract];
  let perDefender = (25 + gap) * mult * (made ? 1 : -1);
  if (petitAuBout !== null) perDefender += (petitAuBout === 0 ? 10 : -10) * mult;
  const dealScores = [0, 1, 2, 3].map((p) => (p === taker ? 3 * perDefender : -perDefender));
  return {
    kind: 'played',
    taker,
    contract,
    oudlers,
    points,
    target,
    made,
    gap,
    petitAuBout,
    perDefender,
    dealScores,
  };
}

function scoreDeal(state: TarotState): TarotState {
  const takerCards = state.won[0];
  const points = tarotCountPoints(takerCards) + state.adjust[0];
  const oudlers = takerCards.filter(tarotIsOudler).length;
  const lastTrick = state.tricks[state.tricks.length - 1];
  const petitAuBout = lastTrick.cards.some((p) => p.card === TAROT_PETIT)
    ? tarotCampOf(lastTrick.winner, state.taker)
    : null;
  const result = tarotScore(state.taker!, state.contract!, points, oudlers, petitAuBout);
  const scores = state.scores.map((s, i) => s + result.dealScores[i]);
  const over = state.dealNumber >= state.deals;
  const best = Math.max(...scores);
  return {
    ...state,
    scores,
    result,
    toAct: -1,
    phase: over ? 'gameOver' : 'dealOver',
    winners: over ? [0, 1, 2, 3].filter((p) => scores[p] === best) : null,
  };
}

// ---------------------------------------------------------------- Robot

/** Rough strength of a hand for bidding (about 40 for a petite, 56 for a garde). */
export function tarotHandScore(hand: Card[]): number {
  const trumps = hand.filter(tarotIsTrump);
  let score = 0;
  for (const t of trumps) {
    const v = tarotValue(t);
    score += 2;
    if (v >= 16) score += 1;
  }
  if (hand.includes(TAROT_MONDE)) score += 9;
  if (hand.includes(TAROT_EXCUSE)) score += 7;
  if (hand.includes(TAROT_PETIT)) score += trumps.length >= 7 ? 8 : trumps.length >= 5 ? 5 : 0;
  if (trumps.length >= 8) score += (trumps.length - 7) * 3;
  for (const s of TAROT_SUITS) {
    const cards = hand.filter((c) => tarotSuitOf(c) === s);
    const has = (r: string) => cards.includes(r + s);
    if (has('R')) score += has('D') ? 9 : 6;
    else if (has('D')) score += 2;
    if (has('C')) score += 1;
    if (cards.length === 0) score += 6;
    else if (cards.length === 1) score += 3;
    else if (cards.length >= 5) score += 3 + 2 * (cards.length - 4);
  }
  return score;
}

/** Contract a robot would like to play with this hand, or null to pass. `bonus` makes it bolder. */
export function tarotWantedContract(hand: Card[], bonus = 0): TarotContract | null {
  const s = tarotHandScore(hand) + bonus;
  if (s >= 80) return 'gardeContre';
  if (s >= 68) return 'gardeSans';
  if (s >= 51) return 'garde';
  if (s >= 40) return 'petite';
  return null;
}

/** The robot's écart: empty the shortest suits to make cuts, then put away points that could be lost. */
export function tarotBotEcart(hand: Card[]): Card[] {
  const candidates = tarotEcartCandidates(hand);
  const plain = candidates.filter((c) => !tarotIsTrump(c));
  if (plain.length <= 6) {
    const trumps = candidates.filter(tarotIsTrump).sort((a, b) => tarotValue(a) - tarotValue(b));
    return [...plain, ...trumps.slice(0, 6 - plain.length)];
  }
  const out: Card[] = [];
  // Try to make voids: a suit with no king whose cards all fit in what is left.
  const bySuit = TAROT_SUITS.map((s) => ({
    s,
    cards: plain.filter((c) => tarotSuitOf(c) === s),
    king: hand.includes('R' + s),
  }))
    .filter((x) => x.cards.length > 0 && !x.king)
    .sort((a, b) => a.cards.length - b.cards.length);
  for (const x of bySuit) {
    if (x.cards.length <= 6 - out.length && x.cards.length <= 3) out.push(...x.cards);
  }
  // Then the most valuable cards left (a lonely queen or cavalier is better saved here), then the smallest.
  const rest = plain
    .filter((c) => !out.includes(c))
    .sort((a, b) => {
      const len = (c: Card) => plain.filter((d) => tarotSuitOf(d) === tarotSuitOf(c)).length;
      return tarotPoints(b) - tarotPoints(a) || len(a) - len(b) || tarotValue(a) - tarotValue(b);
    });
  while (out.length < 6) out.push(rest.shift()!);
  return out;
}

/** A sensible move for the seat whose turn it is. */
export function tarotBotMove(state: TarotState): TarotMove {
  const me = state.toAct;
  const hand = state.hands[me];
  if (state.phase === 'bidding') {
    const best = highestBid(state.bids);
    // Last to speak after three passes: a fair hand is worth a try rather than a redeal.
    const want = tarotWantedContract(hand, state.bids.length === 3 && best === null ? 4 : 0);
    return { type: 'bid', bid: want && contractRank(want) > contractRank(best) ? want : 'pass' };
  }
  if (state.phase === 'ecart') return { type: 'ecart', cards: tarotBotEcart(hand) };
  if (state.phase !== 'playing') throw new Error('Le robot n’a rien à faire');
  return { type: 'play', card: chooseCard(state) };
}

/** What a seat can deduce from the cards played so far. */
function knowledge(state: TarotState, me: number) {
  const played = new Set<Card>();
  // voids[p] holds the suits ('t' for trumps) that player p is known to lack.
  const voids: Set<string>[] = [new Set(), new Set(), new Set(), new Set()];
  const tricks = [...state.tricks.map((t) => t.cards), state.trick];
  for (const cards of tricks) {
    for (let i = 0; i < cards.length; i++) {
      const { player, card } = cards[i];
      played.add(card);
      const led = tarotLedSuit(cards.slice(0, i));
      if (led === null || card === TAROT_EXCUSE) continue;
      const suit = tarotSuitOf(card);
      if (suit !== led) {
        voids[player].add(led);
        if (suit !== 't') voids[player].add('t');
      }
    }
  }
  const mine = new Set([...state.hands[me], ...(me === state.taker ? state.ecart : [])]);
  const unseen = tarotNewDeck().filter((c) => !played.has(c) && !mine.has(c));
  return { played, voids, unseen };
}

function chooseCard(state: TarotState): Card {
  const me = state.toAct;
  const hand = state.hands[me];
  const legal = tarotLegalCards(hand, state.trick);
  if (legal.length === 1) return legal[0];
  const taker = state.taker!;
  const camp = (p: number) => tarotCampOf(p, taker);
  const partner = (p: number) => p !== me && camp(p) === camp(me);
  const { voids, unseen } = knowledge(state, me);
  const trick = state.trick;
  const after = [1, 2, 3].map((i) => (me + i) % 4).slice(0, 3 - trick.length);
  const opponentsAfter = after.filter((p) => !partner(p));
  const unseenTrumps = unseen.filter(tarotIsTrump);
  const pts = tarotPoints;
  const val = tarotValue;
  const isT = tarotIsTrump;
  const nonExcuse = legal.filter((c) => c !== TAROT_EXCUSE);
  const tricksLeft = hand.length;

  // The Excuse must not wait for the last trick, where it would be lost.
  if (legal.includes(TAROT_EXCUSE) && tricksLeft <= 2) return TAROT_EXCUSE;

  /** Lowest card, keeping points, oudlers and high trumps. */
  const cheapest = (cards: Card[]) => {
    const pool = cards.filter((c) => c !== TAROT_EXCUSE);
    const keepPetit = pool.filter((c) => c !== TAROT_PETIT);
    const from = keepPetit.length ? keepPetit : pool.length ? pool : cards;
    return from
      .slice()
      .sort((a, b) => Number(isT(a)) - Number(isT(b)) || pts(a) - pts(b) || val(a) - val(b))[0];
  };

  /** Would `card` still win once the players after me have played? */
  const safeWinner = (card: Card, led: string | null) => {
    if (opponentsAfter.length === 0) return true;
    if (isT(card)) return !unseenTrumps.some((t) => val(t) > val(card));
    if (led === null) return false;
    const higher = unseen.some((c) => tarotSuitOf(c) === led && val(c) > val(card));
    const cutters = opponentsAfter.some((p) => voids[p].has(led) && !voids[p].has('t'));
    return !higher && !cutters;
  };

  if (trick.length === 0) return lead(state, legal, hand, voids, unseen, cheapest, safeWinner);

  const led = tarotLedSuit(trick);
  const winIdx = tarotTrickWinnerIndex(trick);
  const master = trick[winIdx];
  const onTable = trick.reduce((s, p) => s + pts(p.card), 0);
  const ours = partner(master.player);
  const masterSafe = ours && (opponentsAfter.length === 0 || safeWinner(master.card, led));

  if (ours && masterSafe) {
    // Partner surely wins: save the Petit, or give the most points without wasting trumps.
    if (legal.includes(TAROT_PETIT)) return TAROT_PETIT;
    const plain = nonExcuse.filter((c) => !isT(c));
    if (plain.length) return plain.slice().sort((a, b) => pts(b) - pts(a) || val(b) - val(a))[0];
    return cheapest(legal);
  }

  const beats = (c: Card) => {
    if (c === TAROT_EXCUSE) return false;
    const m = master.card;
    if (isT(c)) return !isT(m) || val(c) > val(m);
    return !isT(m) && tarotSuitOf(c) === tarotSuitOf(m) && tarotSuitOf(m) === led && val(c) > val(m);
  };
  const winning = nonExcuse.filter(beats);
  if (winning.length) {
    const safe = winning.filter((c) => safeWinner(c, led));
    // The Petit only goes out when it surely wins.
    const petitOk = winning.includes(TAROT_PETIT) && safe.includes(TAROT_PETIT);
    if (petitOk) return TAROT_PETIT;
    const usable = winning.filter((c) => c !== TAROT_PETIT);
    const safeUsable = safe.filter((c) => c !== TAROT_PETIT);
    if (safeUsable.length) {
      // Win as cheaply as possible, but a suit card with points is fine to cash.
      const plain = safeUsable.filter((c) => !isT(c));
      if (plain.length) return plain.sort((a, b) => pts(b) - pts(a) || val(b) - val(a))[0];
      return safeUsable.sort((a, b) => val(a) - val(b))[0];
    }
    if (usable.length) {
      if (ours) return cheapest(legal);
      const plain = usable.filter((c) => !isT(c));
      // Not sure to win: go high when there is something worth it, otherwise low.
      if (plain.length) return plain.sort((a, b) => val(b) - val(a))[0];
      if (onTable >= 4 || tricksLeft <= 4) return usable.sort((a, b) => val(b) - val(a))[0];
      return usable.sort((a, b) => val(a) - val(b))[0];
    }
  }

  // Cannot win: lose as little as possible. The Excuse saves a valuable card.
  const fallback = cheapest(legal);
  if (
    legal.includes(TAROT_EXCUSE) &&
    !ours &&
    (pts(fallback) >= 2.5 || fallback === TAROT_PETIT || val(fallback) >= 18)
  )
    return TAROT_EXCUSE;
  if (ours && !isT(fallback)) {
    // Partner may still win: a small gift, not a big one.
    const plain = nonExcuse.filter((c) => !isT(c) && pts(c) <= 1.5);
    if (plain.length) return plain.sort((a, b) => pts(b) - pts(a))[0];
  }
  return fallback;
}

function lead(
  state: TarotState,
  legal: Card[],
  hand: Card[],
  voids: Set<string>[],
  unseen: Card[],
  cheapest: (cards: Card[]) => Card,
  safeWinner: (card: Card, led: string | null) => boolean,
): Card {
  const me = state.toAct;
  const taker = state.taker!;
  const iTake = me === taker;
  const isT = tarotIsTrump;
  const val = tarotValue;
  const trumps = hand.filter((c) => isT(c));
  const unseenTrumps = unseen.filter(isT);
  const opponents = [0, 1, 2, 3].filter((p) => p !== me && (iTake || p === taker));
  const timesLed = (s: string) => state.tricks.filter((t) => tarotLedSuit(t.cards) === s).length;
  const suits = TAROT_SUITS.filter((s) => hand.some((c) => tarotSuitOf(c) === s));
  const opponentCuts = (s: string) => opponents.some((p) => voids[p].has(s) && !voids[p].has('t'));

  // A master card in a suit the opponents still follow.
  for (const s of suits) {
    const top = hand.filter((c) => tarotSuitOf(c) === s).sort((a, b) => val(b) - val(a))[0];
    if (val(top) >= 13 && timesLed(s) < 2 && !opponentCuts(s) && safeWinner(top, s)) return top;
  }

  if (iTake) {
    // Pull the defenders' trumps when holding many.
    if (trumps.length >= 6 && unseenTrumps.length > 0) {
      const top = trumps.filter((c) => c !== TAROT_PETIT).sort((a, b) => val(b) - val(a))[0];
      if (top && !unseenTrumps.some((t) => val(t) > val(top))) return top;
      const low = trumps.filter((c) => c !== TAROT_PETIT).sort((a, b) => val(a) - val(b))[0];
      if (low) return low;
    }
    // Otherwise the longest suit, from the bottom.
    const longest = suits
      .slice()
      .sort(
        (a, b) =>
          hand.filter((c) => tarotSuitOf(c) === b).length - hand.filter((c) => tarotSuitOf(c) === a).length,
      )[0];
    if (longest) return cheapest(hand.filter((c) => tarotSuitOf(c) === longest));
    return cheapest(legal);
  }

  // Defence: make the taker cut a suit he lacks, with a small card, or play our longest suit low.
  const takerVoid = suits.filter((s) => voids[taker].has(s) && !voids[taker].has('t'));
  if (takerVoid.length) {
    const cards = hand.filter((c) => (takerVoid as string[]).includes(tarotSuitOf(c)));
    const small = cards.filter((c) => tarotPoints(c) <= 0.5);
    if (small.length) return cheapest(small);
  }
  if (suits.length) {
    const best = suits
      .slice()
      .sort(
        (a, b) =>
          hand.filter((c) => tarotSuitOf(c) === b).length - hand.filter((c) => tarotSuitOf(c) === a).length,
      )[0];
    return cheapest(hand.filter((c) => tarotSuitOf(c) === best));
  }
  return cheapest(legal);
}
