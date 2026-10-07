import { type Card, type Rng, newDeck, shuffle } from './cards.ts';

/**
 * Blackjack against the bank, for 1 to 7 players on one phone.
 *
 * Rules: shoe of 6 decks, reshuffled before a round once fewer than 25% of its cards remain.
 * Blackjack pays 3:2 (rounded down to whole chips), the dealer peeks for blackjack with an
 * ace or a ten showing, stands on every 17 (soft 17 included). Double on the first two cards
 * of any hand (also after a split), split a pair of the same rank once (two hands at most);
 * split aces get one card each. No insurance, no surrender.
 */

export const BJ_DECKS = 6;
export const BJ_MIN_BET = 10;
export const BJ_MAX_SEATS = 7;
/** Share of the shoe below which it is reshuffled before the next round. */
export const BJ_RESHUFFLE_AT = 0.25;

export type BjPhase = 'betting' | 'playing' | 'settled';
export type BjResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';

export interface BjPlayer {
  id: string;
  name: string;
  stack: number;
  bot: boolean;
}

export interface BjHand {
  cards: Card[];
  /** Chips riding on this hand (doubled when the hand was doubled). */
  bet: number;
  doubled: boolean;
  /** Came from a split: 21 on two cards is then not a blackjack. */
  split: boolean;
  done: boolean;
  result: BjResult | null;
  /** Chips given back to the player when the round is settled (bet included). */
  payout: number;
}

export interface BjSeat {
  playerId: string;
  hands: BjHand[];
}

export interface BjState {
  players: BjPlayer[];
  decks: number;
  /** Cards still to deal; the next card is shoe[0]. */
  shoe: Card[];
  /** Cards already played since the last shuffle. */
  discarded: number;
  phase: BjPhase;
  round: number;
  /** Bets chosen so far in the betting phase, by player id. */
  bets: Record<string, number>;
  /** Players dealt into the current round, in seat order. */
  seats: BjSeat[];
  dealer: Card[];
  /** The dealer's second card is face up (the dealer's turn has come or the round ended early). */
  holeRevealed: boolean;
  /** Hand being played, or null when nobody is to play a hand. */
  turn: { seat: number; hand: number } | null;
  /** The shoe was shuffled anew before this round. */
  reshuffled: boolean;
  /** The round ended right after the deal because the dealer had blackjack. */
  dealerBlackjack: boolean;
}

export type BjMove =
  | { type: 'bet'; amount: number }
  | { type: 'hit' }
  | { type: 'stand' }
  | { type: 'double' }
  | { type: 'split' };

export type BjAction = 'hit' | 'stand' | 'double' | 'split';

/** Value of one card for blackjack, with an ace counted as 1. */
export function bjCardValue(card: Card): number {
  const r = card[0];
  if (r === 'A') return 1;
  if (r === 'T' || r === 'J' || r === 'Q' || r === 'K') return 10;
  return Number(r);
}

/**
 * Best total of a hand. `soft` means an ace counts as 11 (so `low` = total - 10 is the other
 * way to count it, shown as "7/17").
 */
export function bjHandValue(cards: Card[]): { total: number; soft: boolean; low: number } {
  let low = 0;
  let aces = 0;
  for (const c of cards) {
    low += bjCardValue(c);
    if (c[0] === 'A') aces++;
  }
  const soft = aces > 0 && low + 10 <= 21;
  return { total: soft ? low + 10 : low, soft, low };
}

/** Text of a hand total: "17", or "7/17" for a soft total. */
export function bjTotalLabel(cards: Card[]): string {
  const v = bjHandValue(cards);
  if (v.soft && v.total < 21) return `${v.low}/${v.total}`;
  return String(v.total);
}

export function bjIsBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && bjHandValue(cards).total === 21;
}

function handIsBlackjack(h: BjHand): boolean {
  return !h.split && bjIsBlackjack(h.cards);
}

export function bjNewShoe(decks: number, rng: Rng): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) cards.push(...newDeck());
  return shuffle(cards, rng);
}

export interface BjOptions {
  players: { id: string; name: string; bot?: boolean }[];
  stack: number;
  decks?: number;
  /** A ready-made shoe (next card first), mostly for tests. */
  shoe?: Card[];
}

export function bjNewGame(opts: BjOptions, rng: Rng): BjState {
  if (opts.players.length < 1 || opts.players.length > BJ_MAX_SEATS)
    throw new Error('Il faut entre 1 et 7 joueurs');
  if (new Set(opts.players.map((p) => p.id)).size !== opts.players.length)
    throw new Error('Deux joueurs ont le même identifiant');
  if (!Number.isInteger(opts.stack) || opts.stack <= 0) throw new Error('Tapis de départ invalide');
  const decks = opts.decks ?? BJ_DECKS;
  return {
    players: opts.players.map((p) => ({ id: p.id, name: p.name, stack: opts.stack, bot: !!p.bot })),
    decks,
    shoe: opts.shoe ? opts.shoe.slice() : bjNewShoe(decks, rng),
    discarded: 0,
    phase: 'betting',
    round: 1,
    bets: {},
    seats: [],
    dealer: [],
    holeRevealed: false,
    turn: null,
    reshuffled: false,
    dealerBlackjack: false,
  };
}

/** Smallest bet this player may make: the table minimum, or all their chips if they have less. */
export function bjMinBet(stack: number): number {
  return Math.min(BJ_MIN_BET, stack);
}

/** Players still in the game (with chips), in seat order. */
export function bjActivePlayers(state: BjState): BjPlayer[] {
  return state.players.filter((p) => p.stack > 0);
}

/** Id of the player who must act now (bet or play a hand), or null. */
export function bjActor(state: BjState): string | null {
  if (state.phase === 'betting') {
    return bjActivePlayers(state).find((p) => state.bets[p.id] === undefined)?.id ?? null;
  }
  if (state.phase === 'playing' && state.turn) return state.seats[state.turn.seat].playerId;
  return null;
}

/** The hand being played right now. */
export function bjCurrentHand(state: BjState): BjHand | null {
  if (state.phase !== 'playing' || !state.turn) return null;
  return state.seats[state.turn.seat].hands[state.turn.hand];
}

/** Actions allowed on the hand being played. */
export function bjLegalActions(state: BjState): BjAction[] {
  const hand = bjCurrentHand(state);
  if (!hand || hand.done) return [];
  const seat = state.seats[state.turn!.seat];
  const player = state.players.find((p) => p.id === seat.playerId)!;
  const actions: BjAction[] = ['hit', 'stand'];
  const two = hand.cards.length === 2;
  if (two && player.stack >= hand.bet) {
    actions.push('double');
    if (seat.hands.length === 1 && hand.cards[0][0] === hand.cards[1][0]) actions.push('split');
  }
  return actions;
}

/** Chips a player owns, counting those riding on hands not yet settled. */
export function bjChips(state: BjState, playerId: string): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return 0;
  if (state.phase !== 'playing') return p.stack;
  const seat = state.seats.find((s) => s.playerId === playerId);
  return p.stack + (seat ? seat.hands.reduce((s, h) => s + h.bet, 0) : 0);
}

/** The game is over once every human player has run out of chips (every player, with robots only). */
export function bjIsOver(state: BjState): boolean {
  if (state.phase !== 'settled') return false;
  const humans = state.players.filter((p) => !p.bot);
  return (humans.length > 0 ? humans : state.players).every((p) => p.stack === 0);
}

/** Players by chips, most first; equal chips share a place. */
export function bjRanking(state: BjState): { id: string; name: string; chips: number; place: number }[] {
  const rows = state.players
    .map((p) => ({ id: p.id, name: p.name, chips: bjChips(state, p.id), place: 0 }))
    .sort((a, b) => b.chips - a.chips);
  rows.forEach((r, i) => (r.place = i > 0 && rows[i - 1].chips === r.chips ? rows[i - 1].place : i + 1));
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Moves

function cardsOnTable(state: BjState): Card[] {
  return [...state.dealer, ...state.seats.flatMap((s) => s.hands.flatMap((h) => h.cards))];
}

/** Takes the next card off the shoe (a fresh shoe, minus the cards on the table, if it ran out). */
function draw(state: BjState, rng: Rng): Card {
  if (state.shoe.length === 0) {
    const onTable = cardsOnTable(state);
    const fresh = bjNewShoe(state.decks, rng);
    for (const c of onTable) fresh.splice(fresh.indexOf(c), 1);
    state.shoe = fresh;
    state.discarded = 0;
    state.reshuffled = true;
  }
  return state.shoe.shift()!;
}

function clone(state: BjState): BjState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    shoe: state.shoe.slice(),
    bets: { ...state.bets },
    seats: state.seats.map((s) => ({ ...s, hands: s.hands.map((h) => ({ ...h, cards: h.cards.slice() })) })),
    dealer: state.dealer.slice(),
    turn: state.turn ? { ...state.turn } : null,
  };
}

function newHand(bet: number, split = false): BjHand {
  return { cards: [], bet, doubled: false, split, done: false, result: null, payout: 0 };
}

export function bjApply(state: BjState, move: BjMove, rng: Rng): BjState {
  const s = clone(state);
  if (move.type === 'bet') {
    if (s.phase !== 'betting') throw new Error("Ce n'est pas le moment de miser");
    return placeBet(s, bjActor(s)!, move.amount, rng);
  }

  if (s.phase !== 'playing' || !s.turn) throw new Error("Ce n'est pas le moment de jouer");
  if (!bjLegalActions(s).includes(move.type)) throw new Error('Action impossible');
  const seat = s.seats[s.turn.seat];
  const hand = seat.hands[s.turn.hand];
  const player = s.players.find((x) => x.id === seat.playerId)!;

  switch (move.type) {
    case 'hit':
      hand.cards.push(draw(s, rng));
      if (bjHandValue(hand.cards).total >= 21) hand.done = true;
      break;
    case 'stand':
      hand.done = true;
      break;
    case 'double':
      player.stack -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(draw(s, rng));
      hand.done = true;
      break;
    case 'split': {
      player.stack -= hand.bet;
      const second = newHand(hand.bet, true);
      second.cards.push(hand.cards.pop()!);
      hand.split = true;
      seat.hands.push(second);
      const aces = hand.cards[0][0] === 'A';
      for (const h of seat.hands) {
        h.cards.push(draw(s, rng));
        // Split aces get a single card each; a 21 needs no more cards.
        if (aces || bjHandValue(h.cards).total === 21) h.done = true;
      }
      break;
    }
  }
  advance(s, rng);
  return s;
}

/**
 * A bet for a given player, in any order (online, everyone bets at the same time). The round is
 * dealt once every player with chips has bet.
 */
export function bjPlaceBet(state: BjState, playerId: string, amount: number, rng: Rng): BjState {
  if (state.phase !== 'betting') throw new Error("Ce n'est pas le moment de miser");
  const p = state.players.find((x) => x.id === playerId);
  if (!p || p.stack === 0) throw new Error("Ce joueur n'a plus de jetons");
  if (state.bets[playerId] !== undefined) throw new Error('Ta mise est déjà posée');
  return placeBet(clone(state), playerId, amount, rng);
}

function placeBet(s: BjState, id: string, amount: number, rng: Rng): BjState {
  const p = s.players.find((x) => x.id === id)!;
  if (!Number.isInteger(amount) || amount < bjMinBet(p.stack) || amount > p.stack)
    throw new Error(`Mise entre ${bjMinBet(p.stack)} et ${p.stack}`);
  s.bets[id] = amount;
  if (bjActivePlayers(s).every((x) => s.bets[x.id] !== undefined)) deal(s, rng);
  return s;
}

/** Starts the round once everyone has bet: reshuffle if needed, deal two cards each, peek. */
function deal(s: BjState, rng: Rng) {
  s.reshuffled = false;
  if (s.shoe.length < s.decks * 52 * BJ_RESHUFFLE_AT) {
    s.shoe = bjNewShoe(s.decks, rng);
    s.discarded = 0;
    s.reshuffled = true;
  }
  s.seats = bjActivePlayers(s).map((p) => {
    p.stack -= s.bets[p.id];
    return { playerId: p.id, hands: [newHand(s.bets[p.id])] };
  });
  s.dealer = [];
  for (let k = 0; k < 2; k++) {
    for (const seat of s.seats) seat.hands[0].cards.push(draw(s, rng));
    s.dealer.push(draw(s, rng));
  }
  s.phase = 'playing';
  s.holeRevealed = false;
  s.dealerBlackjack = false;
  const up = bjCardValue(s.dealer[0]);
  // The dealer peeks under an ace or a ten: a blackjack ends the round at once.
  if ((up === 1 || up === 10) && bjIsBlackjack(s.dealer)) {
    s.dealerBlackjack = true;
    for (const seat of s.seats) seat.hands[0].done = true;
    s.turn = null;
    settle(s);
    return;
  }
  for (const seat of s.seats) if (bjIsBlackjack(seat.hands[0].cards)) seat.hands[0].done = true;
  s.turn = { seat: 0, hand: 0 };
  advance(s, rng);
}

/** Moves the turn to the next hand still to play, or plays the dealer and settles. */
function advance(s: BjState, rng: Rng) {
  let t = s.turn;
  while (t && t.seat < s.seats.length) {
    const hands = s.seats[t.seat].hands;
    if (t.hand < hands.length && !hands[t.hand].done) {
      s.turn = t;
      return;
    }
    t = t.hand + 1 < hands.length ? { seat: t.seat, hand: t.hand + 1 } : { seat: t.seat + 1, hand: 0 };
  }
  s.turn = null;
  // The dealer draws only if some hand still needs beating.
  const live = s.seats.some((seat) =>
    seat.hands.some((h) => bjHandValue(h.cards).total <= 21 && !handIsBlackjack(h)),
  );
  if (live) while (bjHandValue(s.dealer).total < 17) s.dealer.push(draw(s, rng));
  settle(s);
}

/** Reveals the hole card and pays every hand. */
function settle(s: BjState) {
  s.holeRevealed = true;
  const dealer = bjHandValue(s.dealer).total;
  const dealerBj = bjIsBlackjack(s.dealer);
  for (const seat of s.seats) {
    const player = s.players.find((p) => p.id === seat.playerId)!;
    for (const h of seat.hands) {
      const total = bjHandValue(h.cards).total;
      const bj = handIsBlackjack(h);
      if (total > 21) h.result = 'bust';
      else if (bj && dealerBj) h.result = 'push';
      else if (bj) h.result = 'blackjack';
      else if (dealerBj) h.result = 'lose';
      else if (dealer > 21 || total > dealer) h.result = 'win';
      else if (total === dealer) h.result = 'push';
      else h.result = 'lose';
      h.payout =
        h.result === 'blackjack'
          ? h.bet + Math.floor((h.bet * 3) / 2)
          : h.result === 'win'
            ? h.bet * 2
            : h.result === 'push'
              ? h.bet
              : 0;
      h.done = true;
      player.stack += h.payout;
    }
  }
  s.phase = 'settled';
  s.turn = null;
}

/** Clears the table and opens betting for the next round. */
export function bjNextRound(state: BjState): BjState {
  if (state.phase !== 'settled') throw new Error("La manche n'est pas finie");
  if (bjIsOver(state)) throw new Error('La partie est finie');
  const s = clone(state);
  s.discarded += cardsOnTable(s).length;
  s.seats = [];
  s.dealer = [];
  s.bets = {};
  s.holeRevealed = false;
  s.dealerBlackjack = false;
  s.reshuffled = false;
  s.phase = 'betting';
  s.round += 1;
  return s;
}

/** Net chips won (or lost, if negative) by a player in the settled round. */
export function bjRoundNet(state: BjState, playerId: string): number {
  const seat = state.seats.find((x) => x.playerId === playerId);
  if (!seat || state.phase !== 'settled') return 0;
  return seat.hands.reduce((sum, h) => sum + h.payout - h.bet, 0);
}

// ---------------------------------------------------------------------------------------------
// Robot

/** A robot's bet: about 5% of its chips, rounded to 5, at least the table minimum. */
export function bjBotBet(stack: number): number {
  const bet = Math.max(BJ_MIN_BET, Math.round((stack * 0.05) / 5) * 5);
  return Math.min(stack, bet);
}

/**
 * Basic strategy for a multi-deck shoe, dealer standing on soft 17, double after split allowed.
 * Falls back to hitting or standing when doubling or splitting is not allowed.
 */
export function bjBasicStrategy(cards: Card[], dealerUp: Card, legal: BjAction[]): BjAction {
  const up = bjCardValue(dealerUp) === 1 ? 11 : bjCardValue(dealerUp);
  const can = (a: BjAction) => legal.includes(a);
  const { total, soft } = bjHandValue(cards);

  if (can('split') && cards.length === 2 && cards[0][0] === cards[1][0]) {
    const r = bjCardValue(cards[0]);
    const split =
      r === 1 ||
      r === 8 ||
      (r === 9 && up <= 9 && up !== 7) ||
      (r === 7 && up <= 7) ||
      (r === 6 && up <= 6) ||
      (r === 4 && (up === 5 || up === 6)) ||
      ((r === 2 || r === 3) && up <= 7);
    if (split) return 'split';
  }

  const double = (fallback: BjAction): BjAction => (can('double') ? 'double' : fallback);
  if (soft) {
    if (total >= 20) return 'stand';
    if (total === 19) return up === 6 ? double('stand') : 'stand';
    if (total === 18) {
      if (up <= 6) return double('stand');
      return up <= 8 ? 'stand' : 'hit';
    }
    if (total === 17) return up >= 3 && up <= 6 ? double('hit') : 'hit';
    if (total >= 15) return up >= 4 && up <= 6 ? double('hit') : 'hit';
    return up >= 5 && up <= 6 ? double('hit') : 'hit';
  }
  if (total >= 17) return 'stand';
  if (total >= 13) return up <= 6 ? 'stand' : 'hit';
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (total === 11) return up <= 10 ? double('hit') : 'hit';
  if (total === 10) return up <= 9 ? double('hit') : 'hit';
  if (total === 9) return up >= 3 && up <= 6 ? double('hit') : 'hit';
  return 'hit';
}

/** What a robot does now: its bet in the betting phase, otherwise basic strategy. */
export function bjBotMove(state: BjState): BjMove {
  if (state.phase === 'betting') {
    const id = bjActor(state);
    const p = state.players.find((x) => x.id === id);
    if (!p) throw new Error("Personne n'a à miser");
    return { type: 'bet', amount: bjBotBet(p.stack) };
  }
  const hand = bjCurrentHand(state);
  if (!hand) throw new Error("Personne n'a à jouer");
  return { type: bjBasicStrategy(hand.cards, state.dealer[0], bjLegalActions(state)) };
}

// ---------------------------------------------------------------------------------------------
// Online

/**
 * What a player at an online table sees: everything on the felt (every player's cards are face
 * up at blackjack), but not the shoe, and the dealer's second card only once it is turned over.
 */
export interface BjTableView extends Omit<BjState, 'shoe'> {
  /** Cards left in the shoe (its contents stay secret). */
  shoeCount: number;
  /** The dealer's cards, without the hole card while it is face down. */
  dealer: Card[];
  /** How many cards the dealer really has (2 while the hole card is face down). */
  dealerCount: number;
  /** Chips each player started with. */
  startStack: number;
}

export function bjTableView(state: BjState, startStack: number): BjTableView {
  const { shoe, ...rest } = state;
  return {
    ...rest,
    players: state.players.map((p) => ({ ...p })),
    bets: { ...state.bets },
    seats: state.seats.map((s) => ({ ...s, hands: s.hands.map((h) => ({ ...h, cards: h.cards.slice() })) })),
    turn: state.turn ? { ...state.turn } : null,
    dealer: state.holeRevealed ? state.dealer.slice() : state.dealer.slice(0, 1),
    dealerCount: state.dealer.length,
    shoeCount: shoe.length,
    startStack,
  };
}
