import { type Card, type Rng, secureRng, shuffle } from './cards.ts';

/**
 * French rummy ("Rami") for 2 to 4 players, with two 52-card decks and four jokers.
 *
 * Cards carry a third character so the two copies of a card stay apart: "Ah1" and "Ah2" are both
 * the ace of hearts. Jokers are "Xr1", "Xb1", "Xr2", "Xb2" (red and black). The first two
 * characters are the card's face, so the usual card drawing works with them.
 *
 * Melds are sets (3 or 4 cards of one rank, all suits different) and runs (3 or more following
 * cards of one suit; the ace goes below the 2 or above the king, never both). A meld holds at most
 * one joker, which stands for one precise card in a run.
 */

export const RAMI_SUITS = ['s', 'h', 'd', 'c'];
/** Ranks from the ace (1) to the king (13). */
const RANKS = 'A23456789TJQK';
export const RAMI_HAND_SIZE = 13;
/** Points needed in the melds laid down the first time. */
export const RAMI_OPENING = 51;
/** What a player who never laid anything down scores at the end of a round. */
export const RAMI_NOT_OPENED_PENALTY = 100;
export const RAMI_JOKER_PENALTY = 20;
export const RAMI_MIN_PLAYERS = 2;
export const RAMI_MAX_PLAYERS = 4;
/** A round nobody can finish ends after this many turns (or once the stock is used up three times). */
const MAX_TURNS = 400;
const MAX_RESHUFFLES = 2;

export type RamiMeldKind = 'set' | 'run';

export interface RamiMeld {
  id: number;
  /** Who laid it down first. */
  owner: number;
  kind: RamiMeldKind;
  /** In display order: suits for a set, lowest to highest for a run. */
  cards: Card[];
  /** The card each one stands for: its own face, or for a joker the face it replaces ("7*" in a set). */
  faces: string[];
}

export type RamiMove =
  | { type: 'draw' }
  | { type: 'take' }
  | { type: 'meld'; melds: Card[][] }
  | { type: 'add'; meld: number; cards: Card[] }
  | { type: 'swap'; meld: number; card: Card }
  | { type: 'discard'; card: Card };

/** The last thing that happened, for the screen. */
export interface RamiEvent {
  player: number;
  type: RamiMove['type'] | 'reshuffle';
  cards: Card[];
  /** Points laid down, for a meld. */
  points?: number;
  /** The player opened with this move. */
  opening?: boolean;
}

export interface RamiRoundResult {
  /** Who emptied their hand, or null when the round was blocked. */
  winner: number | null;
  /** The winner laid all their cards down at once without having opened before: penalties double. */
  sec: boolean;
  penalties: number[];
  /** Cards left in each hand when the round ended. */
  hands: Card[][];
}

export interface RamiPlayer {
  name: string;
  bot: boolean;
}

export interface RamiState {
  players: RamiPlayer[];
  target: number;
  round: number;
  dealer: number;
  /** Penalty points so far: the lowest score wins. */
  scores: number[];
  hands: Card[][];
  /** Who has laid down their first melds (51 points or more). */
  opened: boolean[];
  stock: Card[];
  /** The discard pile; its top card is the last one. */
  discard: Card[];
  melds: RamiMeld[];
  nextMeldId: number;
  current: number;
  phase: 'draw' | 'play' | 'roundOver' | 'gameOver';
  /** The card taken from the discard pile this turn: it may not be thrown back at once. */
  taken: Card | null;
  /** The current player opened during this turn. */
  openedThisTurn: boolean;
  turns: number;
  reshuffles: number;
  last: RamiEvent | null;
  result: RamiRoundResult | null;
}

// ---------------------------------------------------------------- Cards

export function ramiIsJoker(card: Card): boolean {
  return card[0] === 'X';
}

/** Rank and suit of a card ("Ah"), without the deck number. */
export function ramiFace(card: Card): string {
  return card.slice(0, 2);
}

export function ramiNewDeck(): Card[] {
  const deck: Card[] = [];
  for (const d of ['1', '2']) {
    for (const r of RANKS) for (const s of RAMI_SUITS) deck.push(r + s + d);
    deck.push('Xr' + d, 'Xb' + d);
  }
  return deck;
}

/** Ace low = 1, king = 13. */
function rankIndex(r: string): number {
  return RANKS.indexOf(r) + 1;
}

/** Rank of a position in a run, from 1 (ace low) to 14 (ace high). */
function rankAt(v: number): string {
  return v === 14 ? 'A' : RANKS[v - 1];
}

/** Points of a rank in a set or of a position in a run. */
function positionPoints(v: number): number {
  if (v === 1) return 1;
  if (v === 14) return 11;
  return Math.min(10, v);
}

function rankPoints(r: string): number {
  return r === 'A' ? 11 : Math.min(10, rankIndex(r));
}

/** What a card left in hand costs at the end of a round. */
export function ramiCardPenalty(card: Card): number {
  return ramiIsJoker(card) ? RAMI_JOKER_PENALTY : rankPoints(card[0]);
}

export function ramiHandPenalty(hand: Card[]): number {
  return hand.reduce((s, c) => s + ramiCardPenalty(c), 0);
}

const SUIT_ORDER = 'shcd';

/** Sorts a hand by suit then rank, or by rank then suit; jokers go last. */
export function ramiSortHand(hand: Card[], by: 'suit' | 'rank'): Card[] {
  const key = (c: Card) => {
    if (ramiIsJoker(c)) return 10000 + c.charCodeAt(1);
    const r = c[0] === 'A' ? 14 : rankIndex(c[0]);
    const s = SUIT_ORDER.indexOf(c[1]);
    return by === 'suit' ? s * 100 + r : r * 10 + s;
  };
  return hand.slice().sort((a, b) => key(a) - key(b) || a.localeCompare(b));
}

// ---------------------------------------------------------------- Melds

type Layout = Pick<RamiMeld, 'kind' | 'cards' | 'faces'>;

/** How `cards` lie as a new meld, or null when they make none. */
export function ramiLayout(cards: Card[]): Layout | null {
  if (cards.length < 3 || new Set(cards).size !== cards.length) return null;
  const jokers = cards.filter(ramiIsJoker);
  const nat = cards.filter((c) => !ramiIsJoker(c));
  if (jokers.length > 1 || nat.length < 2) return null;

  if (nat.every((c) => c[0] === nat[0][0])) {
    const suits = nat.map((c) => c[1]);
    if (new Set(suits).size !== suits.length || cards.length > 4) return null;
    const sorted = nat.slice().sort((a, b) => SUIT_ORDER.indexOf(a[1]) - SUIT_ORDER.indexOf(b[1]));
    return {
      kind: 'set',
      cards: [...sorted, ...jokers],
      faces: [...sorted.map(ramiFace), ...jokers.map(() => nat[0][0] + '*')],
    };
  }

  if (!nat.every((c) => c[1] === nat[0][1])) return null;
  const suit = nat[0][1];
  for (const aceHigh of [false, true]) {
    const value = (c: Card) => (c[0] === 'A' && aceHigh ? 14 : rankIndex(c[0]));
    const sorted = nat.slice().sort((a, b) => value(a) - value(b));
    const vals = sorted.map(value);
    if (new Set(vals).size !== vals.length) continue;
    const lo = vals[0];
    const hi = vals[vals.length - 1];
    const gaps = hi - lo + 1 - vals.length;
    let jokerAt: number | null = null;
    if (gaps === 1 && jokers.length === 1) {
      jokerAt = vals.find((v, i) => vals[i + 1] !== undefined && vals[i + 1] !== v + 1)! + 1;
    } else if (gaps === 0 && jokers.length === 1) {
      jokerAt = hi < 14 ? hi + 1 : lo > 1 ? lo - 1 : null;
      if (jokerAt === null) continue;
    } else if (gaps !== 0) continue;
    const from = Math.min(lo, jokerAt ?? lo);
    const to = Math.max(hi, jokerAt ?? hi);
    if (to - from + 1 > 13) continue;
    const out: Card[] = [];
    const faces: string[] = [];
    for (let v = from; v <= to; v++) {
      out.push(v === jokerAt ? jokers[0] : sorted[vals.indexOf(v)]);
      faces.push(rankAt(v) + suit);
    }
    return { kind: 'run', cards: out, faces };
  }
  return null;
}

/** Lowest position of a run (1 for an ace below the 2). */
function runStart(faces: string[]): number {
  return rankIndex(faces[0][0]);
}

/** Points a meld is worth, counting each joker as the card it stands for. */
export function ramiMeldPoints(meld: Layout): number {
  if (meld.kind === 'set') return rankPoints(meld.faces[0][0]) * meld.cards.length;
  const lo = runStart(meld.faces);
  return meld.faces.reduce((s, _, i) => s + positionPoints(lo + i), 0);
}

/** The meld once `card` is added to it, or null when it does not fit. */
function addOne<M extends Layout>(meld: M, card: Card): M | null {
  if (meld.kind === 'set') {
    if (ramiIsJoker(card) && meld.cards.some(ramiIsJoker)) return null;
    const layout = ramiLayout([...meld.cards, card]);
    return layout && layout.kind === 'set' ? { ...meld, ...layout } : null;
  }
  const suit = meld.faces[0][1];
  const lo = runStart(meld.faces);
  const hi = lo + meld.faces.length - 1;
  let at: number | null = null;
  if (ramiIsJoker(card)) {
    if (meld.cards.some(ramiIsJoker)) return null;
    at = hi < 14 ? hi + 1 : lo > 1 ? lo - 1 : null;
  } else if (card[1] === suit) {
    const v = rankIndex(card[0]);
    if (card[0] === 'A') at = hi === 13 ? 14 : lo === 2 ? 1 : null;
    else if (v === hi + 1) at = v;
    else if (v === lo - 1) at = v;
  }
  if (at === null || Math.max(hi, at) - Math.min(lo, at) + 1 > 13) return null;
  const face = rankAt(at) + suit;
  return at > hi
    ? { ...meld, cards: [...meld.cards, card], faces: [...meld.faces, face] }
    : { ...meld, cards: [card, ...meld.cards], faces: [face, ...meld.faces] };
}

/** The meld once all of `cards` are added, in whatever order works, or null. */
export function ramiAddToMeld<M extends Layout>(meld: M, cards: Card[]): M | null {
  if (cards.length === 0) return null;
  let current = meld;
  let left = cards.slice();
  // Naturals first, so a joker goes to the end of the run.
  left.sort((a, b) => Number(ramiIsJoker(a)) - Number(ramiIsJoker(b)));
  while (left.length) {
    let progressed = false;
    for (const c of left) {
      const next = addOne(current, c);
      if (next) {
        current = next;
        left = left.filter((x) => x !== c);
        progressed = true;
        break;
      }
    }
    if (!progressed) return null;
  }
  return current;
}

/** The meld once `card` takes the place of its joker, or null when it may not. */
export function ramiSwapJoker<M extends Layout>(meld: M, card: Card): { meld: M; joker: Card } | null {
  if (ramiIsJoker(card)) return null;
  const j = meld.cards.findIndex(ramiIsJoker);
  if (j < 0) return null;
  const joker = meld.cards[j];
  if (meld.kind === 'run') {
    if (meld.faces[j] !== ramiFace(card)) return null;
    const cards = meld.cards.slice();
    cards[j] = card;
    return { meld: { ...meld, cards }, joker };
  }
  const layout = ramiLayout(meld.cards.map((c, i) => (i === j ? card : c)));
  if (!layout || layout.kind !== 'set') return null;
  return { meld: { ...meld, ...layout }, joker };
}

// ---------------------------------------------------------------- Game

export interface RamiOptions {
  players: RamiPlayer[];
  target?: number;
  dealer?: number;
  rng?: Rng;
  /** Already shuffled deck, for tests. */
  deck?: Card[];
}

function deal(
  base: Omit<RamiState, 'hands' | 'stock' | 'discard' | 'melds' | 'current' | 'phase'> & {
    players: RamiPlayer[];
  },
  rng: Rng,
  deck?: Card[],
): RamiState {
  const n = base.players.length;
  const cards = deck ? deck.slice() : shuffle(ramiNewDeck(), rng);
  if (cards.length !== 108 || new Set(cards).size !== 108) throw new Error('Paquet de 108 cartes invalide');
  const first = (base.dealer + 1) % n;
  const hands: Card[][] = Array.from({ length: n }, () => []);
  for (let k = 0; k < RAMI_HAND_SIZE; k++)
    for (let i = 0; i < n; i++) hands[(first + i) % n].push(cards.shift()!);
  // The first player gets a 14th card and starts by discarding.
  hands[first].push(cards.shift()!);
  return {
    ...base,
    hands,
    stock: cards,
    discard: [],
    melds: [],
    current: first,
    phase: 'play',
  };
}

export function ramiNewGame(opts: RamiOptions): RamiState {
  const n = opts.players.length;
  if (n < RAMI_MIN_PLAYERS || n > RAMI_MAX_PLAYERS) throw new Error('Le rami se joue de 2 à 4');
  const rng = opts.rng ?? secureRng;
  return deal(
    {
      players: opts.players.map((p) => ({ ...p })),
      target: opts.target ?? 300,
      round: 1,
      dealer: opts.dealer ?? rng(n),
      scores: opts.players.map(() => 0),
      opened: opts.players.map(() => false),
      nextMeldId: 1,
      taken: null,
      openedThisTurn: false,
      turns: 0,
      reshuffles: 0,
      last: null,
      result: null,
    },
    rng,
    opts.deck,
  );
}

/** Deals the next round, the next player dealing. */
export function ramiNextRound(state: RamiState, rng: Rng = secureRng, deck?: Card[]): RamiState {
  if (state.phase !== 'roundOver') throw new Error('La manche n’est pas finie');
  const n = state.players.length;
  return deal(
    {
      players: state.players,
      target: state.target,
      round: state.round + 1,
      dealer: (state.dealer + 1) % n,
      scores: state.scores,
      opened: state.players.map(() => false),
      nextMeldId: 1,
      taken: null,
      openedThisTurn: false,
      turns: 0,
      reshuffles: 0,
      last: null,
      result: null,
    },
    rng,
    deck,
  );
}

function removeCards(hand: Card[], cards: Card[]): Card[] {
  for (const c of cards) if (!hand.includes(c)) throw new Error('Tu n’as pas cette carte');
  if (new Set(cards).size !== cards.length) throw new Error('Une carte est en double');
  return hand.filter((c) => !cards.includes(c));
}

function endRound(state: RamiState, winner: number | null): RamiState {
  const sec = winner !== null && state.openedThisTurn;
  const penalties = state.hands.map((h, i) => {
    if (i === winner) return 0;
    const p = state.opened[i] ? ramiHandPenalty(h) : RAMI_NOT_OPENED_PENALTY;
    return sec ? p * 2 : p;
  });
  const scores = state.scores.map((s, i) => s + penalties[i]);
  const over = scores.some((s) => s >= state.target);
  return {
    ...state,
    scores,
    phase: over ? 'gameOver' : 'roundOver',
    result: { winner, sec, penalties, hands: state.hands.map((h) => h.slice()) },
  };
}

/** Plays a move for the current player. */
export function ramiApply(state: RamiState, move: RamiMove, rng: Rng = secureRng): RamiState {
  const me = state.current;
  const hand = state.hands[me];
  const setHand = (h: Card[]) => state.hands.map((x, i) => (i === me ? h : x));

  if (state.phase === 'draw') {
    if (move.type === 'take') {
      const top = state.discard[state.discard.length - 1];
      if (!top) throw new Error('La défausse est vide');
      return {
        ...state,
        hands: setHand([...hand, top]),
        discard: state.discard.slice(0, -1),
        taken: top,
        phase: 'play',
        last: { player: me, type: 'take', cards: [top] },
      };
    }
    if (move.type !== 'draw') throw new Error('Pioche d’abord une carte');
    let { stock, discard, reshuffles } = state;
    let reshuffled = false;
    if (stock.length === 0) {
      if (discard.length <= 1 || reshuffles >= MAX_RESHUFFLES) return endRound(state, null);
      stock = shuffle(discard.slice(0, -1), rng);
      discard = discard.slice(-1);
      reshuffles++;
      reshuffled = true;
    }
    const card = stock[0];
    return {
      ...state,
      hands: setHand([...hand, card]),
      stock: stock.slice(1),
      discard,
      reshuffles,
      phase: 'play',
      taken: null,
      last: { player: me, type: reshuffled ? 'reshuffle' : 'draw', cards: [] },
    };
  }

  if (state.phase !== 'play') throw new Error('La manche est finie');

  if (move.type === 'meld') {
    if (move.melds.length === 0) throw new Error('Rien à poser');
    const all = move.melds.flat();
    const rest = removeCards(hand, all);
    const layouts = move.melds.map((m) => {
      const l = ramiLayout(m);
      if (!l) throw new Error('Ce n’est pas une combinaison valable');
      return l;
    });
    const points = layouts.reduce((s, l) => s + ramiMeldPoints(l), 0);
    const opening = !state.opened[me];
    if (opening && points < RAMI_OPENING)
      throw new Error(`Il faut au moins ${RAMI_OPENING} points pour ouvrir (tu en as ${points})`);
    const melds = [...state.melds, ...layouts.map((l, i) => ({ ...l, id: state.nextMeldId + i, owner: me }))];
    const next: RamiState = {
      ...state,
      hands: setHand(rest),
      melds,
      nextMeldId: state.nextMeldId + layouts.length,
      opened: state.opened.map((o, i) => o || i === me),
      openedThisTurn: state.openedThisTurn || opening,
      last: { player: me, type: 'meld', cards: all, points, opening },
    };
    return rest.length === 0 ? endRound(next, me) : next;
  }

  if (move.type === 'add' || move.type === 'swap') {
    if (!state.opened[me]) throw new Error(`Ouvre d’abord avec ${RAMI_OPENING} points`);
    const target = state.melds.find((m) => m.id === move.meld);
    if (!target) throw new Error('Combinaison introuvable');
    if (move.type === 'add') {
      const rest = removeCards(hand, move.cards);
      const meld = ramiAddToMeld(target, move.cards);
      if (!meld) throw new Error('Ces cartes ne vont pas sur cette combinaison');
      const next: RamiState = {
        ...state,
        hands: setHand(rest),
        melds: state.melds.map((m) => (m.id === meld.id ? meld : m)),
        last: { player: me, type: 'add', cards: move.cards },
      };
      return rest.length === 0 ? endRound(next, me) : next;
    }
    const rest = removeCards(hand, [move.card]);
    const swapped = ramiSwapJoker(target, move.card);
    if (!swapped) throw new Error('Cette carte ne remplace pas le joker');
    return {
      ...state,
      hands: setHand([...rest, swapped.joker]),
      melds: state.melds.map((m) => (m.id === target.id ? swapped.meld : m)),
      last: { player: me, type: 'swap', cards: [move.card] },
    };
  }

  if (move.type !== 'discard') throw new Error('Tu as déjà pioché');
  if (!hand.includes(move.card)) throw new Error('Tu n’as pas cette carte');
  if (move.card === state.taken && hand.length > 1)
    throw new Error('Tu ne peux pas rejeter la carte que tu viens de prendre');
  const rest = hand.filter((c) => c !== move.card);
  const next: RamiState = {
    ...state,
    hands: setHand(rest),
    discard: [...state.discard, move.card],
    last: { player: me, type: 'discard', cards: [move.card] },
  };
  if (rest.length === 0) return endRound(next, me);
  if (state.turns + 1 >= MAX_TURNS) return endRound({ ...next, turns: state.turns + 1 }, null);
  return {
    ...next,
    current: (me + 1) % state.players.length,
    phase: 'draw',
    taken: null,
    openedThisTurn: false,
    turns: state.turns + 1,
  };
}

/** Players from the best (lowest score) to the worst, with shared places on ties. */
export function ramiRanking(
  state: RamiState,
): { player: number; name: string; score: number; place: number }[] {
  const rows = state.players
    .map((p, i) => ({ player: i, name: p.name, score: state.scores[i], place: 0 }))
    .sort((a, b) => a.score - b.score || a.player - b.player);
  rows.forEach((r, i) => (r.place = i > 0 && rows[i - 1].score === r.score ? rows[i - 1].place : i + 1));
  return rows;
}

// ---------------------------------------------------------------- Robot

interface Candidate {
  /** Natural faces used ("7h"). */
  faces: string[];
  jokers: number;
  points: number;
}

function candidates(faces: Map<string, number>, jokers: number): Candidate[] {
  const out: Candidate[] = [];
  // Sets.
  for (const r of RANKS) {
    const suits = RAMI_SUITS.filter((s) => faces.has(r + s));
    const subsets = (k: number): string[][] => {
      const res: string[][] = [];
      const rec = (start: number, acc: string[]) => {
        if (acc.length === k) return void res.push(acc);
        for (let i = start; i < suits.length; i++) rec(i + 1, [...acc, suits[i]]);
      };
      rec(0, []);
      return res;
    };
    for (const k of [3, 4])
      for (const s of subsets(k))
        out.push({ faces: s.map((x) => r + x), jokers: 0, points: rankPoints(r) * k });
    if (jokers > 0)
      for (const k of [2, 3])
        for (const s of subsets(k))
          out.push({ faces: s.map((x) => r + x), jokers: 1, points: rankPoints(r) * (k + 1) });
  }
  // Runs.
  for (const s of RAMI_SUITS) {
    const has = (v: number) => faces.has(rankAt(v) + s);
    for (let lo = 1; lo <= 12; lo++) {
      for (let hi = lo + 2; hi <= Math.min(14, lo + 12); hi++) {
        let missing = 0;
        const used: string[] = [];
        let points = 0;
        for (let v = lo; v <= hi; v++) {
          points += positionPoints(v);
          if (has(v)) used.push(rankAt(v) + s);
          else missing++;
        }
        // Longer windows only miss more cards.
        if (missing > 1) break;
        if (missing === 1 && jokers === 0) continue;
        if (used.length < 2) continue;
        out.push({ faces: used, jokers: missing, points });
      }
    }
  }
  return out;
}

interface Partition {
  melds: Candidate[];
  covered: number;
  points: number;
}

/** The best way to lay down `hand`: as many cards as possible, or as many points before opening. */
function bestPartition(hand: Card[], byPoints: boolean): Partition {
  const faces = new Map<string, number>();
  let jokers = 0;
  for (const c of hand) {
    if (ramiIsJoker(c)) jokers++;
    else faces.set(ramiFace(c), (faces.get(ramiFace(c)) ?? 0) + 1);
  }
  const cands = candidates(faces, jokers);
  const byFace = new Map<string, Candidate[]>();
  for (const c of cands) for (const f of c.faces) byFace.set(f, [...(byFace.get(f) ?? []), c]);
  const order = [...faces.keys()];
  const score = (p: Partition) => (byPoints ? p.points * 100 + p.covered : p.covered * 1000 + p.points);
  let best: Partition = { melds: [], covered: 0, points: 0 };
  let nodes = 0;
  const counts = new Map(faces);
  let jokersLeft = jokers;
  const chosen: Candidate[] = [];
  let covered = 0;
  let points = 0;

  const rec = (i: number) => {
    if (++nodes > 3000) return;
    while (i < order.length && (counts.get(order[i]) ?? 0) === 0) i++;
    if (i >= order.length) {
      const p = { melds: chosen.slice(), covered, points };
      if (score(p) > score(best)) best = p;
      return;
    }
    const f = order[i];
    for (const c of byFace.get(f) ?? []) {
      if (c.jokers > jokersLeft || c.faces.some((x) => (counts.get(x) ?? 0) === 0)) continue;
      for (const x of c.faces) counts.set(x, counts.get(x)! - 1);
      jokersLeft -= c.jokers;
      chosen.push(c);
      covered += c.faces.length + c.jokers;
      points += c.points;
      rec(i);
      chosen.pop();
      covered -= c.faces.length + c.jokers;
      points -= c.points;
      jokersLeft += c.jokers;
      for (const x of c.faces) counts.set(x, counts.get(x)! + 1);
    }
    // Leave this card out of every meld.
    counts.set(f, counts.get(f)! - 1);
    rec(i);
    counts.set(f, counts.get(f)! + 1);
  };
  rec(0);
  return best;
}

/** Turns a partition back into real cards from the hand. */
function partitionCards(hand: Card[], melds: Candidate[]): Card[][] {
  const pool = hand.slice();
  const take = (pred: (c: Card) => boolean) => {
    const i = pool.findIndex(pred);
    const [c] = pool.splice(i, 1);
    return c;
  };
  return melds.map((m) => [
    ...m.faces.map((f) => take((c) => !ramiIsJoker(c) && ramiFace(c) === f)),
    ...Array.from({ length: m.jokers }, () => take(ramiIsJoker)),
  ]);
}

/** How promising the cards left out of melds are: pairs, near runs and jokers. */
function potential(cards: Card[]): number {
  let p = 0;
  for (let i = 0; i < cards.length; i++) {
    const a = cards[i];
    if (ramiIsJoker(a)) {
      p += 3;
      continue;
    }
    for (let j = i + 1; j < cards.length; j++) {
      const b = cards[j];
      if (ramiIsJoker(b)) continue;
      if (a[0] === b[0] && a[1] !== b[1]) p += 1;
      else if (a[1] === b[1]) {
        const va = rankIndex(a[0]);
        const vb = rankIndex(b[0]);
        let d = Math.abs(va - vb);
        if (a[0] === 'A' || b[0] === 'A')
          d = Math.min(d, Math.abs((va === 1 ? 14 : va) - (vb === 1 ? 14 : vb)));
        if (d === 1) p += 1.2;
        else if (d === 2) p += 0.8;
      }
    }
  }
  return p;
}

function handValue(hand: Card[], opened: boolean): number {
  const part = bestPartition(hand, !opened);
  const used = new Set(partitionCards(hand, part.melds).flat());
  const left = hand.filter((c) => !used.has(c));
  const base = opened ? part.covered * 10 : part.points + part.covered * 3;
  return base + potential(left) * 2.5 - ramiHandPenalty(left) * 0.2;
}

function fitsTable(state: RamiState, card: Card): boolean {
  return state.melds.some((m) => addOne(m, card) !== null);
}

/** A sensible move for the current player, one step at a time. */
export function ramiBotMove(state: RamiState): RamiMove {
  const me = state.current;
  const hand = state.hands[me];
  const opened = state.opened[me];

  if (state.phase === 'draw') {
    const top = state.discard[state.discard.length - 1];
    if (top) {
      if (ramiIsJoker(top)) return { type: 'take' };
      if (opened && fitsTable(state, top)) return { type: 'take' };
      const before = bestPartition(hand, !opened);
      const after = bestPartition([...hand, top], !opened);
      const gain = opened ? after.covered - before.covered : after.points - before.points;
      if (gain > 0 && (opened || after.covered > before.covered)) return { type: 'take' };
    }
    return { type: 'draw' };
  }
  if (state.phase !== 'play') throw new Error('Le robot n’a rien à faire');

  // Lay down every meld it can (at least 51 points the first time).
  const part = bestPartition(hand, !opened);
  if (part.melds.length > 0) {
    const melds = partitionCards(hand, part.melds);
    const layouts = melds.map(ramiLayout);
    const points = layouts.reduce((s, l) => s + (l ? ramiMeldPoints(l) : 0), 0);
    if (layouts.every(Boolean) && (opened || points >= RAMI_OPENING)) return { type: 'meld', melds };
  }

  if (opened) {
    // Win a joker back, then add cards to the table.
    for (const m of state.melds)
      for (const c of hand) if (ramiSwapJoker(m, c)) return { type: 'swap', meld: m.id, card: c };
    for (const c of hand) {
      // A joker is worth more in hand, unless it helps to finish.
      if (ramiIsJoker(c) && hand.length > 2) continue;
      const m = state.melds.find((x) => addOne(x, c) !== null);
      if (m) return { type: 'add', meld: m.id, cards: [c] };
    }
  }

  // Throw the card that hurts the hand least.
  const choices = hand.filter((c) => c !== state.taken || hand.length === 1);
  let best = choices[0];
  let bestValue = -Infinity;
  const seen = new Set<string>();
  for (const c of choices) {
    const key = ramiIsJoker(c) ? 'X' : ramiFace(c);
    if (seen.has(key)) continue;
    seen.add(key);
    let v = handValue(
      hand.filter((x) => x !== c),
      opened,
    );
    if (ramiIsJoker(c)) v -= 30;
    // Do not hand a useful card to the next players.
    if (fitsTable(state, c)) v -= 4;
    if (v > bestValue) {
      bestValue = v;
      best = c;
    }
  }
  return { type: 'discard', card: best };
}
