import { type Card, type Rng, secureRng, shuffle } from './cards.ts';

/**
 * Classic French Belote (not coinche) for four players in two teams.
 * Seats go round the table: 0 = South, 1 = West, 2 = North, 3 = East.
 * The player "on the left" of someone is the next seat. Team 0 is South + North, team 1 West + East.
 */

export type BeloteSuit = 's' | 'h' | 'd' | 'c';
export const BELOTE_SUITS: BeloteSuit[] = ['s', 'h', 'd', 'c'];
export const BELOTE_RANKS = '789TJQKA';

export type BeloteTeam = 0 | 1;

export interface BelotePlayedCard {
  player: number;
  card: Card;
}

export type BeloteMove =
  | { type: 'take' }
  | { type: 'pass' }
  | { type: 'choose'; suit: BeloteSuit }
  | { type: 'play'; card: Card };

export type BeloteDealResult =
  | { kind: 'redeal' }
  | {
      kind: 'played';
      taker: number;
      takerTeam: BeloteTeam;
      trump: BeloteSuit;
      /** Points won with the cards, including the 10 of the last trick (252 for a capot). */
      cardPoints: [number, number];
      /** 20 for the team that played belote and rebelote, 0 otherwise. */
      belote: [number, number];
      /** Team that won all eight tricks, if any. */
      capot: BeloteTeam | null;
      made: boolean;
      /** What each team adds to its score for this deal. */
      dealPoints: [number, number];
    };

export interface BeloteState {
  phase: 'bidding1' | 'bidding2' | 'playing' | 'dealOver' | 'gameOver';
  target: number;
  dealer: number;
  /** Deals played so far in this game, the current one included. */
  dealNumber: number;
  scores: [number, number];
  hands: Card[][];
  /** Cards still to deal once someone has taken. */
  stock: Card[];
  turnUp: Card | null;
  /** Seat whose turn it is, or -1 when nobody has to act. */
  toAct: number;
  /** Bids of the current deal, in order. */
  bids: { player: number; bid: 'pass' | 'take' | BeloteSuit; round: 1 | 2 }[];
  trump: BeloteSuit | null;
  taker: number | null;
  trick: BelotePlayedCard[];
  lastTrick: { cards: BelotePlayedCard[]; winner: number } | null;
  tricksWon: [number, number];
  /** Card points won so far, last-trick bonus included. */
  points: [number, number];
  /** Player holding the king and queen of trump, if any. */
  beloteHolder: number | null;
  /** How many of those two cards the holder has played. */
  belotePlayed: number;
  /** Last announcement, for the screen. */
  announce: { player: number; text: 'Belote' | 'Rebelote' } | null;
  result: BeloteDealResult | null;
  /** Set once the game is over. */
  winner: BeloteTeam | null;
}

const TRUMP_ORDER = '78QKTA9J'; // weakest to strongest
const PLAIN_ORDER = '789JQKTA';
const TRUMP_POINTS: Record<string, number> = { J: 20, '9': 14, A: 11, T: 10, K: 4, Q: 3, '8': 0, '7': 0 };
const PLAIN_POINTS: Record<string, number> = { A: 11, T: 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };

export const BELOTE_SUIT_NAMES: Record<BeloteSuit, string> = {
  s: 'pique',
  h: 'cœur',
  d: 'carreau',
  c: 'trèfle',
};
export const BELOTE_SUIT_SYMBOLS: Record<BeloteSuit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

export function beloteTeamOf(player: number): BeloteTeam {
  return (player % 2) as BeloteTeam;
}

export function belotePartner(player: number): number {
  return (player + 2) % 4;
}

export function beloteNewDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of BELOTE_RANKS) for (const s of BELOTE_SUITS) deck.push(r + s);
  return deck;
}

export function belotePoints(card: Card, trump: BeloteSuit | null): number {
  return card[1] === trump ? TRUMP_POINTS[card[0]] : PLAIN_POINTS[card[0]];
}

/** Strength of a card within its own suit (0 = weakest), using the trump order for trumps. */
export function beloteStrength(card: Card, trump: BeloteSuit | null): number {
  return (card[1] === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(card[0]);
}

/** Does card `a` beat card `b` already on the table, given the suit led? */
function beats(a: Card, b: Card, led: string, trump: BeloteSuit): boolean {
  if (a[1] === b[1]) return beloteStrength(a, trump) > beloteStrength(b, trump);
  if (a[1] === trump) return true;
  if (b[1] === trump) return false;
  return a[1] === led && b[1] !== led;
}

/** Index in `trick` of the card currently winning it. */
export function beloteTrickWinnerIndex(trick: BelotePlayedCard[], trump: BeloteSuit): number {
  const led = trick[0].card[1];
  let best = 0;
  for (let i = 1; i < trick.length; i++) if (beats(trick[i].card, trick[best].card, led, trump)) best = i;
  return best;
}

/** Cards `player` may play from `hand` on the current `trick`. */
export function beloteLegalCards(
  hand: Card[],
  trick: BelotePlayedCard[],
  trump: BeloteSuit,
  player: number,
): Card[] {
  if (trick.length === 0) return hand.slice();
  const led = trick[0].card[1];
  const trumps = hand.filter((c) => c[1] === trump);
  const highestTrump = trick
    .filter((p) => p.card[1] === trump)
    .reduce((m, p) => Math.max(m, beloteStrength(p.card, trump)), -1);
  const overTrumps = trumps.filter((c) => beloteStrength(c, trump) > highestTrump);

  const following = hand.filter((c) => c[1] === led);
  if (following.length > 0) {
    // Trump led: go higher if you can.
    if (led === trump) return overTrumps.length > 0 ? overTrumps : following;
    return following;
  }
  // Cannot follow suit.
  const master = trick[beloteTrickWinnerIndex(trick, trump)].player;
  if (master === belotePartner(player)) return hand.slice();
  if (trumps.length === 0) return hand.slice();
  // Must trump, and overtrump if you can; otherwise trump lower ("pisser").
  return overTrumps.length > 0 ? overTrumps : trumps;
}

export function beloteLegalMoves(state: BeloteState): BeloteMove[] {
  if (state.phase === 'bidding1') return [{ type: 'take' }, { type: 'pass' }];
  if (state.phase === 'bidding2') {
    const turned = state.turnUp![1];
    return [
      ...BELOTE_SUITS.filter((s) => s !== turned).map((suit) => ({ type: 'choose' as const, suit })),
      { type: 'pass' },
    ];
  }
  if (state.phase === 'playing') {
    return beloteLegalCards(state.hands[state.toAct], state.trick, state.trump!, state.toAct).map((card) => ({
      type: 'play' as const,
      card,
    }));
  }
  return [];
}

function sortHand(hand: Card[], trump: BeloteSuit | null): Card[] {
  const suitOrder = ['s', 'h', 'c', 'd'];
  return hand
    .slice()
    .sort(
      (a, b) =>
        suitOrder.indexOf(a[1]) - suitOrder.indexOf(b[1]) ||
        beloteStrength(b, trump) - beloteStrength(a, trump),
    );
}

export interface BeloteDealOptions {
  dealer: number;
  target?: number;
  scores?: [number, number];
  dealNumber?: number;
  rng?: Rng;
  /** Already shuffled 32 cards, for tests. */
  deck?: Card[];
}

/** Deals 3 then 2 cards to everyone, starting on the dealer's left, and turns up the next card. */
export function beloteStartDeal(opts: BeloteDealOptions): BeloteState {
  const deck = opts.deck ? opts.deck.slice() : shuffle(beloteNewDeck(), opts.rng ?? secureRng);
  if (deck.length !== 32 || new Set(deck).size !== 32) throw new Error('Paquet de 32 cartes invalide');
  const hands: Card[][] = [[], [], [], []];
  let k = 0;
  for (const count of [3, 2])
    for (let i = 1; i <= 4; i++) {
      const p = (opts.dealer + i) % 4;
      for (let c = 0; c < count; c++) hands[p].push(deck[k++]);
    }
  const turnUp = deck[k++];
  return {
    phase: 'bidding1',
    target: opts.target ?? 1000,
    dealer: opts.dealer,
    dealNumber: opts.dealNumber ?? 1,
    scores: opts.scores ?? [0, 0],
    hands: hands.map((h) => sortHand(h, null)),
    stock: deck.slice(k),
    turnUp,
    toAct: (opts.dealer + 1) % 4,
    bids: [],
    trump: null,
    taker: null,
    trick: [],
    lastTrick: null,
    tricksWon: [0, 0],
    points: [0, 0],
    beloteHolder: null,
    belotePlayed: 0,
    announce: null,
    result: null,
    winner: null,
  };
}

export function beloteNewGame(opts: {
  target?: number;
  dealer?: number;
  rng?: Rng;
  deck?: Card[];
}): BeloteState {
  return beloteStartDeal({ dealer: opts.dealer ?? 3, target: opts.target, rng: opts.rng, deck: opts.deck });
}

/** Starts the next deal (after a finished deal or a redeal), with the next dealer. */
export function beloteNextDeal(state: BeloteState, rng: Rng = secureRng, deck?: Card[]): BeloteState {
  if (state.phase !== 'dealOver') throw new Error('La donne n’est pas finie');
  return beloteStartDeal({
    dealer: (state.dealer + 1) % 4,
    target: state.target,
    scores: state.scores,
    dealNumber: state.dealNumber + 1,
    rng,
    deck,
  });
}

/** The taker gets the turned-up card and 2 more, the others 3 more each. */
function finishDeal(state: BeloteState, taker: number, trump: BeloteSuit): BeloteState {
  const hands = state.hands.map((h) => h.slice());
  const stock = state.stock.slice();
  hands[taker].push(state.turnUp!);
  for (let i = 1; i <= 4; i++) {
    const p = (state.dealer + i) % 4;
    const count = p === taker ? 2 : 3;
    for (let c = 0; c < count; c++) hands[p].push(stock.shift()!);
  }
  const holder = hands.findIndex((h) => h.includes('K' + trump) && h.includes('Q' + trump));
  return {
    ...state,
    phase: 'playing',
    hands: hands.map((h) => sortHand(h, trump)),
    stock,
    trump,
    taker,
    toAct: (state.dealer + 1) % 4,
    beloteHolder: holder >= 0 ? holder : null,
  };
}

export function beloteApply(state: BeloteState, player: number, move: BeloteMove): BeloteState {
  if (player !== state.toAct) throw new Error('Ce n’est pas ton tour');
  if (state.phase === 'bidding1' || state.phase === 'bidding2') {
    const round = state.phase === 'bidding1' ? 1 : 2;
    if (move.type === 'pass') {
      const bids = [...state.bids, { player, bid: 'pass' as const, round: round as 1 | 2 }];
      const next = (player + 1) % 4;
      if (next !== (state.dealer + 1) % 4) return { ...state, bids, toAct: next };
      // Everyone has spoken in this round.
      if (round === 1) return { ...state, bids, phase: 'bidding2', toAct: next };
      return { ...state, bids, phase: 'dealOver', toAct: -1, result: { kind: 'redeal' } };
    }
    if (round === 1 && move.type === 'take') {
      const trump = state.turnUp![1] as BeloteSuit;
      return finishDeal(
        { ...state, bids: [...state.bids, { player, bid: 'take', round: 1 }] },
        player,
        trump,
      );
    }
    if (round === 2 && move.type === 'choose') {
      if (!BELOTE_SUITS.includes(move.suit) || move.suit === state.turnUp![1])
        throw new Error('Il faut choisir une autre couleur que celle retournée');
      return finishDeal(
        { ...state, bids: [...state.bids, { player, bid: move.suit, round: 2 }] },
        player,
        move.suit,
      );
    }
    throw new Error('Annonce impossible maintenant');
  }

  if (state.phase !== 'playing' || move.type !== 'play') throw new Error('Coup impossible maintenant');
  const trump = state.trump!;
  const hand = state.hands[player];
  if (!hand.includes(move.card)) throw new Error('Tu n’as pas cette carte');
  if (!beloteLegalCards(hand, state.trick, trump, player).includes(move.card))
    throw new Error('Cette carte n’est pas permise');

  const hands = state.hands.map((h, i) => (i === player ? h.filter((c) => c !== move.card) : h));
  const trick = [...state.trick, { player, card: move.card }];
  let { belotePlayed, announce } = state;
  announce = null;
  if (
    player === state.beloteHolder &&
    move.card[1] === trump &&
    (move.card[0] === 'K' || move.card[0] === 'Q')
  ) {
    belotePlayed++;
    announce = { player, text: belotePlayed === 1 ? 'Belote' : 'Rebelote' };
  }
  if (trick.length < 4) {
    return { ...state, hands, trick, toAct: (player + 1) % 4, belotePlayed, announce };
  }

  const winner = trick[beloteTrickWinnerIndex(trick, trump)].player;
  const team = beloteTeamOf(winner);
  const last = hands[0].length === 0;
  const won = trick.reduce((s, p) => s + belotePoints(p.card, trump), 0) + (last ? 10 : 0);
  const points: [number, number] = [...state.points];
  points[team] += won;
  const tricksWon: [number, number] = [...state.tricksWon];
  tricksWon[team]++;
  const next: BeloteState = {
    ...state,
    hands,
    trick: [],
    lastTrick: { cards: trick, winner },
    toAct: winner,
    points,
    tricksWon,
    belotePlayed,
    announce,
  };
  return last ? scoreDeal(next) : next;
}

/** Works out the deal's result once the 8 tricks are played, and whether the game is over. */
export function beloteScore(
  taker: number,
  trump: BeloteSuit,
  points: [number, number],
  tricksWon: [number, number],
  beloteTeam: BeloteTeam | null,
): Extract<BeloteDealResult, { kind: 'played' }> {
  const takerTeam = beloteTeamOf(taker);
  const def = (1 - takerTeam) as BeloteTeam;
  const capot: BeloteTeam | null = tricksWon[0] === 8 ? 0 : tricksWon[1] === 8 ? 1 : null;
  const cardPoints: [number, number] = [...points];
  if (capot !== null) {
    cardPoints[capot] = 252;
    cardPoints[(1 - capot) as BeloteTeam] = 0;
  }
  const belote: [number, number] = [0, 0];
  if (beloteTeam !== null) belote[beloteTeam] = 20;
  const made = cardPoints[takerTeam] + belote[takerTeam] > cardPoints[def] + belote[def];
  const dealPoints: [number, number] = [0, 0];
  if (made) {
    dealPoints[0] = cardPoints[0] + belote[0];
    dealPoints[1] = cardPoints[1] + belote[1];
  } else {
    dealPoints[def] = (capot === def ? 252 : 162) + belote[def];
    dealPoints[takerTeam] = belote[takerTeam];
  }
  return { kind: 'played', taker, takerTeam, trump, cardPoints, belote, capot, made, dealPoints };
}

function scoreDeal(state: BeloteState): BeloteState {
  const beloteTeam =
    state.beloteHolder !== null && state.belotePlayed === 2 ? beloteTeamOf(state.beloteHolder) : null;
  const result = beloteScore(state.taker!, state.trump!, state.points, state.tricksWon, beloteTeam);
  const scores: [number, number] = [
    state.scores[0] + result.dealPoints[0],
    state.scores[1] + result.dealPoints[1],
  ];
  let winner: BeloteTeam | null = null;
  if (Math.max(...scores) >= state.target && scores[0] !== scores[1]) winner = scores[0] > scores[1] ? 0 : 1;
  return {
    ...state,
    scores,
    result,
    toAct: -1,
    phase: winner === null ? 'dealOver' : 'gameOver',
    winner,
  };
}

// ---------------------------------------------------------------- Robot

/** Rough value of a hand if `trump` were trump. */
function handStrength(hand: Card[], trump: BeloteSuit): { score: number; trumps: number; jack: boolean } {
  const trumps = hand.filter((c) => c[1] === trump);
  const has = (r: string) => trumps.some((c) => c[0] === r);
  let score = 0;
  if (has('J')) score += 4;
  if (has('9')) score += 3;
  if (has('A')) score += 2;
  score += trumps.filter((c) => !'J9A'.includes(c[0])).length;
  for (const c of hand) {
    if (c[1] === trump) continue;
    if (c[0] === 'A') score += 1.5;
    else if (c[0] === 'T' && hand.includes('A' + c[1])) score += 0.5;
  }
  return { score, trumps: trumps.length, jack: has('J') };
}

function wantsToTake(hand: Card[], trump: BeloteSuit, extra: number): boolean {
  const { score, trumps, jack } = handStrength(hand, trump);
  if (jack && trumps >= 2 && score >= 5 + extra) return true;
  return trumps >= 2 && score >= 7 + extra;
}

/** A sensible move for the player whose turn it is. */
export function beloteBotMove(state: BeloteState): BeloteMove {
  const me = state.toAct;
  const hand = state.hands[me];
  if (state.phase === 'bidding1') {
    const trump = state.turnUp![1] as BeloteSuit;
    return wantsToTake([...hand, state.turnUp!], trump, 0) ? { type: 'take' } : { type: 'pass' };
  }
  if (state.phase === 'bidding2') {
    let best: { suit: BeloteSuit; score: number } | null = null;
    for (const suit of BELOTE_SUITS) {
      if (suit === state.turnUp![1] || !wantsToTake(hand, suit, 1)) continue;
      const { score } = handStrength(hand, suit);
      if (!best || score > best.score) best = { suit, score };
    }
    return best ? { type: 'choose', suit: best.suit } : { type: 'pass' };
  }
  if (state.phase !== 'playing') throw new Error('Le robot n’a rien à faire');
  return { type: 'play', card: chooseCard(state) };
}

function chooseCard(state: BeloteState): Card {
  const me = state.toAct;
  const trump = state.trump!;
  const hand = state.hands[me];
  const legal = beloteLegalCards(hand, state.trick, trump, me);
  if (legal.length === 1) return legal[0];
  const pts = (c: Card) => belotePoints(c, trump);
  const str = (c: Card) => beloteStrength(c, trump);
  const isTrump = (c: Card) => c[1] === trump;
  // Cheapest card: non-trump first, then fewest points, then weakest.
  const cheapest = (cards: Card[]) =>
    cards
      .slice()
      .sort((a, b) => Number(isTrump(a)) - Number(isTrump(b)) || pts(a) - pts(b) || str(a) - str(b))[0];

  if (state.trick.length === 0) {
    const ourSideTook = beloteTeamOf(state.taker!) === beloteTeamOf(me);
    // The taking side pulls trumps with the jack.
    if (ourSideTook && hand.includes('J' + trump) && hand.filter(isTrump).length >= 2) return 'J' + trump;
    const aces = legal.filter((c) => c[0] === 'A' && !isTrump(c));
    if (aces.length) return aces[0];
    const plain = legal.filter((c) => !isTrump(c) && c[0] !== 'T');
    if (plain.length) return cheapest(plain);
    return cheapest(legal);
  }

  const winnerIdx = beloteTrickWinnerIndex(state.trick, trump);
  const master = state.trick[winnerIdx];
  const lastToPlay = state.trick.length === 3;
  if (master.player === belotePartner(me)) {
    // Partner is winning: give points, but keep trumps.
    const safe = lastToPlay || master.card[1] === trump || master.card[0] === 'A';
    const plain = legal.filter((c) => !isTrump(c));
    if (plain.length) {
      if (safe) return plain.slice().sort((a, b) => pts(b) - pts(a))[0];
      return cheapest(plain);
    }
    return cheapest(legal);
  }
  const led = state.trick[0].card[1];
  const winning = legal.filter((c) => beats(c, master.card, led, trump));
  if (winning.length) {
    if (lastToPlay) return cheapest(winning);
    const plainWinners = winning.filter((c) => !isTrump(c));
    if (plainWinners.length) return plainWinners.sort((a, b) => str(b) - str(a))[0];
    return winning.slice().sort((a, b) => str(a) - str(b))[0];
  }
  return cheapest(legal);
}
