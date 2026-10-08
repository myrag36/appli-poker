import { type Card, type Rng, newDeck, secureRng, shuffle } from './cards.ts';

/**
 * Uno and 8 américain: two "get rid of your cards" games played with the same engine.
 *
 * - Uno uses its own 108-card deck. A card is three chars: color (r, y, g, b, or w for the
 *   black wild cards), symbol (0-9, S = Passe, R = Inverse, D = +2, W = Joker, F = +4) and a
 *   copy letter so that every card is unique, e.g. "r5a", "gDb", "wFc".
 * - 8 américain uses the standard 52-card deck ("8h", "Td"…): the 8 changes the suit, the 2
 *   makes the next player draw 2 (they may stack another 2), the Valet skips, the As reverses.
 *
 * Both share the flow: match the color (suit) or the symbol (rank) of the top card, draw one
 * card when you can't (and play it if it fits), announce "Uno !" / "Carte !" when one card is
 * left or get caught and draw 2, and the first to empty their hand wins the round.
 */

export type UnoVariant = 'uno' | 'huit';

/** What a card does once played. */
export type UnoKind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export const UNO_COLORS = ['r', 'y', 'g', 'b'] as const;
export const HUIT_SUITS = ['s', 'h', 'd', 'c'] as const;

export const UNO_COLOR_NAMES: Record<string, string> = { r: 'rouge', y: 'jaune', g: 'vert', b: 'bleu' };
export const HUIT_SUIT_NAMES: Record<string, string> = { s: 'pique', h: 'cœur', d: 'carreau', c: 'trèfle' };

export const UNO_MIN_PLAYERS = 2;
export const UNO_MAX_PLAYERS = 6;
/** Cards dealt to each player at the start of a round. */
export const UNO_HAND_SIZE = 7;
/** Cards drawn by a player caught without announcing their last card. */
export const UNO_PENALTY = 2;

/** Points to reach to win the game, offered in the setup; 0 plays a single round. */
export const UNO_TARGETS: Record<UnoVariant, number[]> = { uno: [0, 200, 500], huit: [0, 100, 200] };

export interface UnoPlayer {
  id: string;
  name: string;
  hand: Card[];
  /** Points won over the rounds so far. */
  score: number;
  /** Announced "Uno !" / "Carte !" for the card they are about to keep alone. */
  said: boolean;
}

/** The last thing that happened, for the screen's captions and animations. */
export type UnoEvent =
  | {
      type: 'play';
      player: number;
      card: Card;
      color?: string;
      /** Uno's +2 and +4: who drew at once, and how many. */
      penalty?: { player: number; count: number };
    }
  | { type: 'draw'; player: number; count: number; forced: boolean }
  | { type: 'pass'; player: number }
  | { type: 'say'; player: number }
  | { type: 'catch'; player: number; target: number };

export type UnoPhase = 'playing' | 'roundOver' | 'gameOver';

export interface UnoState {
  variant: UnoVariant;
  players: UnoPlayer[];
  /** 1 for the first round. */
  round: number;
  phase: UnoPhase;
  /** Points to reach to win; 0 for a single round. */
  target: number;
  /** Face-down draw pile; the next card drawn is the last one. */
  deck: Card[];
  /** Face-up pile; the top card is the last one. */
  discard: Card[];
  /** Color (Uno) or suit (8 américain) to follow: the top card's, or the one chosen with a wild. */
  color: string;
  /** Whose turn it is. */
  current: number;
  /** 1 clockwise, -1 after an odd number of reverses. */
  direction: 1 | -1;
  /** Cards the current player must draw unless they stack (8 américain only). */
  pendingDraw: number;
  /** Card the current player just drew: they may play it or keep it and pass. */
  drawn: Card | null;
  /** A player left with one card who has not announced it yet: anyone may catch them. */
  exposed: number | null;
  /** Who dealt this round; the player after them starts. */
  dealer: number;
  /** Winner of the round just finished, and the points they scored. */
  roundWinner: number | null;
  roundPoints: number;
  /** Winner of the whole game once it is over. */
  winner: number | null;
  last: UnoEvent | null;
  /** Counts every move, so the screen can tell two identical events apart. */
  seq: number;
}

export type UnoMove =
  | { type: 'play'; card: Card; color?: string; say?: boolean }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'say' }
  | { type: 'catch'; target: number };

/* ------------------------------------------------------------------ cards */

/** Color (Uno: r/y/g/b/w) or suit (8 américain) of a card. */
export function unoColorOf(variant: UnoVariant, card: Card): string {
  return variant === 'uno' ? card[0] : card[1];
}

/** Symbol (Uno) or rank (8 américain) of a card. */
export function unoSymbolOf(variant: UnoVariant, card: Card): string {
  return variant === 'uno' ? card[1] : card[0];
}

export function unoKind(variant: UnoVariant, card: Card): UnoKind {
  const s = unoSymbolOf(variant, card);
  if (variant === 'uno') {
    switch (s) {
      case 'S':
        return 'skip';
      case 'R':
        return 'reverse';
      case 'D':
        return 'draw2';
      case 'W':
        return 'wild';
      case 'F':
        return 'wild4';
      default:
        return 'number';
    }
  }
  switch (s) {
    case '8':
      return 'wild';
    case '2':
      return 'draw2';
    case 'J':
      return 'skip';
    case 'A':
      return 'reverse';
    default:
      return 'number';
  }
}

export function unoIsWild(variant: UnoVariant, card: Card): boolean {
  const k = unoKind(variant, card);
  return k === 'wild' || k === 'wild4';
}

/** The colors (suits) a wild card may ask for. */
export function unoColors(variant: UnoVariant): readonly string[] {
  return variant === 'uno' ? UNO_COLORS : HUIT_SUITS;
}

export function unoColorName(variant: UnoVariant, color: string): string {
  return (variant === 'uno' ? UNO_COLOR_NAMES : HUIT_SUIT_NAMES)[color] ?? color;
}

/** The 108 cards of a Uno deck. */
export function unoDeck(): Card[] {
  const out: Card[] = [];
  for (const c of UNO_COLORS) {
    out.push(`${c}0a`);
    for (const s of '123456789SRD') out.push(`${c}${s}a`, `${c}${s}b`);
  }
  for (const copy of 'abcd') out.push(`wW${copy}`, `wF${copy}`);
  return out;
}

function deckFor(variant: UnoVariant): Card[] {
  return variant === 'uno' ? unoDeck() : newDeck();
}

/** What a card left in hand costs at the end of a round. */
export function unoCardPoints(variant: UnoVariant, card: Card): number {
  const s = unoSymbolOf(variant, card);
  if (variant === 'uno') {
    if (s >= '0' && s <= '9') return Number(s);
    return unoIsWild(variant, card) ? 50 : 20;
  }
  if (s === '8') return 50;
  if (s === '2' || s === 'J' || s === 'A') return 20;
  if (s === 'K' || s === 'Q' || s === 'T') return 10;
  return Number(s);
}

const UNO_SORT = 'rygbw';
const HUIT_SORT = 'shdc';
const UNO_SYMBOLS = '0123456789SRDWF';
const HUIT_RANKS = '3456789TJQKA2';

/** Groups a hand by color, then symbol, wild cards last. */
export function unoSort(variant: UnoVariant, cards: Card[]): Card[] {
  const colorOrder = variant === 'uno' ? UNO_SORT : HUIT_SORT;
  const symbolOrder = variant === 'uno' ? UNO_SYMBOLS : HUIT_RANKS;
  const key = (c: Card) => {
    // The 8s go last in 8 américain, like the wild cards in Uno.
    const wild = variant === 'huit' && unoSymbolOf(variant, c) === '8' ? 1 : 0;
    return (
      wild * 10000 +
      colorOrder.indexOf(unoColorOf(variant, c)) * 100 +
      symbolOrder.indexOf(unoSymbolOf(variant, c)) * 4 +
      Math.max(0, 'abcd'.indexOf(c[2] ?? 'a'))
    );
  };
  return [...cards].sort((a, b) => key(a) - key(b));
}

/* ------------------------------------------------------------------ setup */

function step(state: { players: unknown[]; direction: 1 | -1 }, from: number, count = 1): number {
  const n = state.players.length;
  return (((from + state.direction * count) % n) + n) % n;
}

/** Deals a round: everyone gets 7 cards and the first plain card of the pile is turned over. */
function deal(
  variant: UnoVariant,
  players: UnoPlayer[],
  dealer: number,
  rng: Rng,
): Pick<UnoState, 'players' | 'deck' | 'discard' | 'color'> {
  const deck = shuffle(deckFor(variant), rng);
  const hands: Card[][] = players.map(() => []);
  for (let k = 0; k < UNO_HAND_SIZE; k++)
    for (let i = 0; i < players.length; i++) hands[(dealer + 1 + i) % players.length].push(deck.pop()!);
  // The game opens on a plain card: special ones are slid back into the pile.
  let top = deck.pop()!;
  while (unoKind(variant, top) !== 'number') {
    deck.splice(rng(deck.length + 1), 0, top);
    top = deck.pop()!;
  }
  return {
    players: players.map((p, i) => ({ ...p, hand: unoSort(variant, hands[i]), said: false })),
    deck,
    discard: [top],
    color: unoColorOf(variant, top),
  };
}

/** Starts a game; `target` is the score to reach (0 for a single round). */
export function unoNewGame(
  variant: UnoVariant,
  players: { id: string; name: string }[],
  target = 0,
  rng: Rng = secureRng,
): UnoState {
  if (players.length < UNO_MIN_PLAYERS || players.length > UNO_MAX_PLAYERS)
    throw new Error(`Il faut de ${UNO_MIN_PLAYERS} à ${UNO_MAX_PLAYERS} joueurs`);
  const dealer = rng(players.length);
  const base = players.map((p) => ({ id: p.id, name: p.name, hand: [], score: 0, said: false }));
  return {
    variant,
    ...deal(variant, base, dealer, rng),
    round: 1,
    phase: 'playing',
    target,
    current: (dealer + 1) % players.length,
    direction: 1,
    pendingDraw: 0,
    drawn: null,
    exposed: null,
    dealer,
    roundWinner: null,
    roundPoints: 0,
    winner: null,
    last: null,
    seq: 0,
  };
}

/** Deals the next round once one is over; the deal moves to the left. */
export function unoNextRound(state: UnoState, rng: Rng = secureRng): UnoState {
  if (state.phase !== 'roundOver') throw new Error("La manche n'est pas finie");
  const dealer = (state.dealer + 1) % state.players.length;
  return {
    ...state,
    ...deal(state.variant, state.players, dealer, rng),
    round: state.round + 1,
    phase: 'playing',
    current: (dealer + 1) % state.players.length,
    direction: 1,
    pendingDraw: 0,
    drawn: null,
    exposed: null,
    dealer,
    roundWinner: null,
    roundPoints: 0,
    last: null,
    seq: state.seq + 1,
  };
}

/* ------------------------------------------------------------------ rules */

export function unoTop(state: UnoState): Card {
  return state.discard[state.discard.length - 1];
}

/** Whether `card` may go on the pile now, whatever the hand around it. */
function fits(state: UnoState, card: Card): boolean {
  const v = state.variant;
  if (state.pendingDraw > 0) return unoKind(v, card) === 'draw2';
  if (unoIsWild(v, card)) return true;
  return unoColorOf(v, card) === state.color || unoSymbolOf(v, card) === unoSymbolOf(v, unoTop(state));
}

/** Whether player `index` may play `card` right now. */
export function unoCanPlay(state: UnoState, index: number, card: Card): boolean {
  if (state.phase !== 'playing' || state.current !== index) return false;
  const hand = state.players[index].hand;
  if (!hand.includes(card)) return false;
  // Right after drawing, only the drawn card may be played.
  if (state.drawn !== null && card !== state.drawn) return false;
  if (!fits(state, card)) return false;
  // The +4 is only allowed without a card of the color asked for.
  if (unoKind(state.variant, card) === 'wild4')
    return !hand.some((c) => !unoIsWild(state.variant, c) && unoColorOf(state.variant, c) === state.color);
  return true;
}

/** Every card player `index` may play right now. */
export function unoLegalCards(state: UnoState, index: number): Card[] {
  if (state.phase !== 'playing' || state.current !== index) return [];
  return state.players[index].hand.filter((c) => unoCanPlay(state, index, c));
}

/** Whether the player may draw: on their turn, unless they already drew a card. */
export function unoCanDraw(state: UnoState, index: number): boolean {
  return state.phase === 'playing' && state.current === index && state.drawn === null;
}

/** Whether a player could announce their last card now ("Uno !" / "Carte !"). */
export function unoCanSay(state: UnoState, index: number): boolean {
  if (state.phase !== 'playing') return false;
  const p = state.players[index];
  if (p.said) return false;
  // Caught out with one card: say it before someone else notices.
  if (state.exposed === index) return true;
  // About to play the second to last card.
  return state.current === index && p.hand.length === 2;
}

/** Whether `by` may catch `target` for not announcing their last card. */
export function unoCanCatch(state: UnoState, by: number, target: number): boolean {
  return state.phase === 'playing' && state.exposed === target && by !== target;
}

/** Takes `count` cards from the pile, turning the discard over when it runs out. */
function drawCards(state: UnoState, index: number, count: number, rng: Rng): UnoState {
  let deck = state.deck;
  let discard = state.discard;
  const got: Card[] = [];
  for (let k = 0; k < count; k++) {
    if (deck.length === 0) {
      if (discard.length <= 1) break;
      deck = shuffle(discard.slice(0, -1), rng);
      discard = discard.slice(-1);
    }
    got.push(deck[deck.length - 1]);
    deck = deck.slice(0, -1);
  }
  const players = state.players.map((p, i) =>
    i === index ? { ...p, hand: unoSort(state.variant, [...p.hand, ...got]), said: false } : p,
  );
  return { ...state, deck, discard, players };
}

/** Points a round winner scores: everything left in the other hands. */
export function unoHandPoints(state: UnoState, index: number): number {
  return state.players[index].hand.reduce((s, c) => s + unoCardPoints(state.variant, c), 0);
}

function endRound(state: UnoState, winner: number): UnoState {
  const points = state.players.reduce((s, _, i) => (i === winner ? s : s + unoHandPoints(state, i)), 0);
  const players = state.players.map((p, i) => (i === winner ? { ...p, score: p.score + points } : p));
  const over = state.target === 0 || players[winner].score >= state.target;
  return {
    ...state,
    players,
    phase: over ? 'gameOver' : 'roundOver',
    roundWinner: winner,
    roundPoints: points,
    winner: over ? winner : null,
    exposed: null,
    pendingDraw: 0,
    drawn: null,
  };
}

/** Applies a move by player `index`; throws on anything the rules do not allow. */
export function unoApply(state: UnoState, index: number, move: UnoMove, rng: Rng = secureRng): UnoState {
  if (state.phase !== 'playing') throw new Error('La manche est finie');
  const v = state.variant;
  const seq = state.seq + 1;

  if (move.type === 'say') {
    if (!unoCanSay(state, index)) throw new Error('Pas maintenant');
    return {
      ...state,
      players: state.players.map((p, i) => (i === index ? { ...p, said: true } : p)),
      exposed: state.exposed === index ? null : state.exposed,
      last: { type: 'say', player: index },
      seq,
    };
  }

  if (move.type === 'catch') {
    if (!unoCanCatch(state, index, move.target)) throw new Error('Trop tard !');
    const next = drawCards(state, move.target, UNO_PENALTY, rng);
    return { ...next, exposed: null, last: { type: 'catch', player: index, target: move.target }, seq };
  }

  if (state.current !== index) throw new Error("Ce n'est pas ton tour");
  // Whatever the current player does now, it is too late to catch anyone.
  const base: UnoState = { ...state, exposed: null };

  if (move.type === 'draw') {
    if (!unoCanDraw(state, index)) throw new Error('Tu as déjà pioché');
    if (state.pendingDraw > 0) {
      // Takes the whole penalty and loses the turn.
      const count = state.pendingDraw;
      const next = drawCards(base, index, count, rng);
      return {
        ...next,
        pendingDraw: 0,
        current: step(state, index),
        last: { type: 'draw', player: index, count, forced: true },
        seq,
      };
    }
    const before = base.players[index].hand;
    const next = drawCards(base, index, 1, rng);
    const card = next.players[index].hand.find((c) => !before.includes(c)) ?? null;
    const last: UnoEvent = { type: 'draw', player: index, count: card ? 1 : 0, forced: false };
    const after = { ...next, drawn: card, last, seq };
    // Nothing to play with it: the turn goes on at once.
    if (!card || !unoCanPlay(after, index, card))
      return { ...after, drawn: null, current: step(state, index) };
    return after;
  }

  if (move.type === 'pass') {
    if (state.drawn === null) throw new Error("Pioche d'abord une carte");
    return { ...base, drawn: null, current: step(state, index), last: { type: 'pass', player: index }, seq };
  }

  const { card } = move;
  if (!unoCanPlay(state, index, card)) throw new Error('Cette carte ne va pas');
  const kind = unoKind(v, card);
  const wild = kind === 'wild' || kind === 'wild4';
  if (wild && !unoColors(v).includes(move.color ?? '')) throw new Error('Choisis une couleur');
  const me = state.players[index];
  const hand = me.hand.filter((c) => c !== card);
  const said = hand.length === 1 && (me.said || move.say === true);
  const players = state.players.map((p, i) => (i === index ? { ...p, hand, said } : p));
  let next: UnoState = {
    ...base,
    players,
    discard: [...state.discard, card],
    color: wild ? move.color! : unoColorOf(v, card),
    drawn: null,
    last: { type: 'play', player: index, card, color: wild ? move.color : undefined },
    seq,
  };
  if (hand.length === 0) return endRound(next, index);
  if (hand.length === 1 && !said) next = { ...next, exposed: index };

  const n = state.players.length;
  switch (kind) {
    case 'skip':
      return { ...next, current: step(next, index, 2) };
    case 'reverse': {
      const direction = -state.direction as 1 | -1;
      // With two players a reverse works like a skip: the same player goes again.
      return { ...next, direction, current: n === 2 ? index : step({ ...next, direction }, index) };
    }
    case 'draw2':
      if (v === 'huit') return { ...next, pendingDraw: state.pendingDraw + 2, current: step(next, index) };
      return drawAndSkip(next, index, 2, rng);
    case 'wild4':
      return drawAndSkip(next, index, 4, rng);
    default:
      return { ...next, current: step(next, index) };
  }
}

/** Uno's +2 and +4: the next player draws at once and misses their turn. */
function drawAndSkip(state: UnoState, from: number, count: number, rng: Rng): UnoState {
  const victim = step(state, from);
  const next = drawCards(state, victim, count, rng);
  const last =
    state.last?.type === 'play' ? { ...state.last, penalty: { player: victim, count } } : state.last;
  return { ...next, last, current: step(state, from, 2) };
}

/** Players by total points, best first, sharing a place on equal points. */
export function unoStandings(
  state: UnoState,
): { index: number; name: string; score: number; place: number }[] {
  const sorted = state.players
    .map((p, index) => ({ index, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
  return sorted.map((e) => ({ ...e, place: sorted.findIndex((x) => x.score === e.score) + 1 }));
}

/* ------------------------------------------------------------------ robots */

/** The color a robot asks for: the one it holds most of (by count, then points). */
function bestColor(state: UnoState, hand: Card[], rng: Rng): string {
  const v = state.variant;
  const colors = unoColors(v);
  const weight = (color: string) =>
    hand
      .filter((c) => !unoIsWild(v, c) && unoColorOf(v, c) === color)
      .reduce((s, c) => s + 10 + unoCardPoints(v, c) / 10, 0);
  let best = colors[rng(colors.length)];
  for (const c of colors) if (weight(c) > weight(best)) best = c;
  return best;
}

/**
 * A robot's turn. It keeps its wild cards for when nothing else fits, sheds expensive cards
 * first, sticks to the color it holds most of, and saves its attacks (+2, Passe…) for a
 * neighbour about to go out. `forget` (0-100) is how often it forgets to announce its last card.
 */
export function unoBotMove(state: UnoState, index: number, rng: Rng = secureRng, forget = 12): UnoMove {
  const v = state.variant;
  const me = state.players[index];
  const legal = unoLegalCards(state, index);
  if (legal.length === 0) return state.drawn !== null ? { type: 'pass' } : { type: 'draw' };

  const nextPlayer = state.players[step(state, index)];
  const threat = nextPlayer.hand.length <= 2;
  const colorCount = (color: string) =>
    me.hand.filter((c) => !unoIsWild(v, c) && unoColorOf(v, c) === color).length;

  const score = (card: Card): number => {
    const kind = unoKind(v, card);
    let s = unoCardPoints(v, card) / 5;
    if (kind === 'wild' || kind === 'wild4') {
      // Kept for later unless the hand is almost empty or someone is about to win.
      s -= me.hand.length <= 2 ? 0 : threat ? 10 : 40;
      if (kind === 'wild4' && threat) s += 30;
    } else {
      s += colorCount(unoColorOf(v, card)) * 3;
      if (kind === 'draw2' || kind === 'skip') s += threat ? 30 : -2;
      if (kind === 'reverse') s += threat && state.players.length > 2 ? 20 : 0;
    }
    return s + rng(3);
  };

  let card = legal[0];
  for (const c of legal) if (score(c) > score(card)) card = c;
  // A drawn card that is a wild is often worth keeping.
  if (state.drawn !== null && unoIsWild(v, card) && me.hand.length > 4 && !threat && rng(100) < 60)
    return { type: 'pass' };
  const rest = me.hand.filter((c) => c !== card);
  return {
    type: 'play',
    card,
    color: unoIsWild(v, card) ? bestColor(state, rest, rng) : undefined,
    say: rest.length === 1 ? rng(100) >= forget : undefined,
  };
}

/** Whether a robot notices someone who forgot to announce their last card (0-100 chance). */
export function unoBotCatches(state: UnoState, rng: Rng = secureRng, chance = 70): boolean {
  return state.exposed !== null && rng(100) < chance;
}
