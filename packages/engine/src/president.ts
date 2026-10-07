import { type Card, type Rng, newDeck, secureRng, shuffle } from './cards.ts';

/**
 * Président (also called Trouduc): one 52-card deck shared out between 3 and 8 players.
 * Everyone tries to empty their hand first; the finishing order gives each player a title,
 * and the next round starts with the losers handing their best cards to the winners.
 */

/** Card ranks from lowest to highest: the 2 beats everything. */
export const PRESIDENT_ORDER = '3456789TJQKA2';

export type PresidentTitle = 'president' | 'vice-president' | 'neutre' | 'vice-trouduc' | 'trouduc';

export const PRESIDENT_TITLE_NAMES: Record<PresidentTitle, string> = {
  president: 'Président',
  'vice-president': 'Vice-président',
  neutre: 'Neutre',
  'vice-trouduc': 'Vice-trouduc',
  trouduc: 'Trouduc',
};

export interface PresidentPlayer {
  id: string;
  name: string;
  hand: Card[];
  /** Points won over all the rounds so far. */
  score: number;
  /** What the player did last in the current trick: shows a "Passe" bubble. */
  passed: boolean;
}

export interface PresidentPlay {
  player: number;
  cards: Card[];
}

export interface PresidentExchange {
  from: number;
  to: number;
  cards: Card[];
}

export type PresidentPhase = 'exchange' | 'playing' | 'roundOver';

export interface PresidentState {
  players: PresidentPlayer[];
  /** 1 for the first round of the game. */
  round: number;
  phase: PresidentPhase;
  /** Whose move it is (a play, a pass, or cards to give back during the exchange); -1 when the round is over. */
  toAct: number;
  /** Plays of the trick in progress, oldest first; empty when someone has to lead. */
  trick: PresidentPlay[];
  /** The plays of the trick that was just won, kept for the screen until someone plays again. */
  lastTrick: { winner: number; plays: PresidentPlay[] } | null;
  /** Passes in a row since the last play of the trick. */
  passes: number;
  /** Players in the order they emptied their hand this round. */
  finished: number[];
  /** Cards played so far this round. */
  played: Card[];
  /** Titles won in the last completed round (indexed by player); null before the first one ends. */
  titles: (PresidentTitle | null)[];
  /** Cards given back by the winners that are still to be chosen, first one first. */
  pendingGives: { from: number; to: number; count: number }[];
  /** Every card handed over at the start of this round. */
  exchanges: PresidentExchange[];
}

export type PresidentMove =
  | { type: 'play'; cards: Card[] }
  | { type: 'pass' }
  | { type: 'give'; cards: Card[] };

/** 0 for a 3 up to 12 for a 2. */
export function presidentRank(card: Card): number {
  return PRESIDENT_ORDER.indexOf(card[0]);
}

/** Lowest card first; same ranks are kept in a steady suit order. */
export function presidentSort(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) => presidentRank(a) - presidentRank(b) || 'cdhs'.indexOf(a[1]) - 'cdhs'.indexOf(b[1]),
  );
}

/** The title each finishing position earns, first to last, for a table of `n` players. */
export function presidentTitles(n: number): PresidentTitle[] {
  const out: PresidentTitle[] = Array.from({ length: n }, () => 'neutre');
  out[0] = 'president';
  out[n - 1] = 'trouduc';
  if (n >= 4) {
    out[1] = 'vice-president';
    out[n - 2] = 'vice-trouduc';
  }
  return out;
}

/** Points for a title: Président 3 (2 without a vice), Vice-président 2, Neutre 1, the others 0. */
export function presidentPoints(title: PresidentTitle, n: number): number {
  switch (title) {
    case 'president':
      return n >= 4 ? 3 : 2;
    case 'vice-president':
      return 2;
    case 'neutre':
      return 1;
    default:
      return 0;
  }
}

function deal(n: number, rng: Rng, round: number): Card[][] {
  const deck = shuffle(newDeck(), rng);
  const hands: Card[][] = Array.from({ length: n }, () => []);
  // Who gets the odd extra cards changes from one round to the next.
  deck.forEach((c, i) => hands[(i + round - 1) % n].push(c));
  return hands.map(presidentSort);
}

/** Starts a game: deals the first round, led by whoever holds the 3 of clubs. */
export function presidentNewGame(
  players: { id: string; name: string }[],
  rng: Rng = secureRng,
): PresidentState {
  if (players.length < 3 || players.length > 8) throw new Error('Il faut de 3 à 8 joueurs');
  const hands = deal(players.length, rng, 1);
  const first = hands.findIndex((h) => h.includes('3c'));
  return {
    players: players.map((p, i) => ({ id: p.id, name: p.name, hand: hands[i], score: 0, passed: false })),
    round: 1,
    phase: 'playing',
    toAct: first,
    trick: [],
    lastTrick: null,
    passes: 0,
    finished: [],
    played: [],
    titles: players.map(() => null),
    pendingGives: [],
    exchanges: [],
  };
}

/** Best cards of a hand, highest first. */
function best(hand: Card[], count: number): Card[] {
  return presidentSort(hand).reverse().slice(0, count);
}

function moveCards(players: PresidentPlayer[], from: number, to: number, cards: Card[]) {
  players[from] = { ...players[from], hand: players[from].hand.filter((c) => !cards.includes(c)) };
  players[to] = { ...players[to], hand: presidentSort([...players[to].hand, ...cards]) };
}

/**
 * Deals the next round. The Trouduc hands his 2 best cards to the Président and the
 * Vice-trouduc his best card to the Vice-président; the winners then choose what to give back.
 */
export function presidentNextRound(state: PresidentState, rng: Rng = secureRng): PresidentState {
  if (state.phase !== 'roundOver') throw new Error("La manche n'est pas finie");
  const n = state.players.length;
  const hands = deal(n, rng, state.round + 1);
  const players = state.players.map((p, i) => ({ ...p, hand: hands[i], passed: false }));
  const who = (t: PresidentTitle) => state.titles.indexOf(t);
  const exchanges: PresidentExchange[] = [];
  const pendingGives: PresidentState['pendingGives'] = [];
  const pairs: [PresidentTitle, PresidentTitle, number][] = [
    ['trouduc', 'president', 2],
    ['vice-trouduc', 'vice-president', 1],
  ];
  for (const [low, high, count] of pairs) {
    const from = who(low);
    const to = who(high);
    if (from < 0 || to < 0) continue;
    const cards = best(players[from].hand, count);
    moveCards(players, from, to, cards);
    exchanges.push({ from, to, cards });
    pendingGives.push({ from: to, to: from, count });
  }
  return {
    ...state,
    players,
    round: state.round + 1,
    phase: 'exchange',
    toAct: pendingGives[0].from,
    trick: [],
    lastTrick: null,
    passes: 0,
    finished: [],
    played: [],
    pendingGives,
    exchanges,
  };
}

/** The rank and size of the play to beat, or null when the player leads. */
export function presidentToBeat(state: PresidentState): { rank: number; count: number } | null {
  const last = state.trick[state.trick.length - 1];
  return last ? { rank: presidentRank(last.cards[0]), count: last.cards.length } : null;
}

function combinations(cards: Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  if (cards.length < size) return [];
  const [head, ...rest] = cards;
  return [...combinations(rest, size - 1).map((c) => [head, ...c]), ...combinations(rest, size)];
}

/** Whether `cards` may be played right now by player `index`. */
export function presidentCanPlay(state: PresidentState, index: number, cards: Card[]): boolean {
  if (state.phase !== 'playing' || state.toAct !== index) return false;
  const hand = state.players[index].hand;
  if (cards.length < 1 || cards.length > 4) return false;
  if (new Set(cards).size !== cards.length || !cards.every((c) => hand.includes(c))) return false;
  const rank = presidentRank(cards[0]);
  if (!cards.every((c) => presidentRank(c) === rank)) return false;
  const toBeat = presidentToBeat(state);
  if (!toBeat) {
    // The very first play of the game must include the 3 of clubs.
    return !(state.round === 1 && state.played.length === 0) || cards.includes('3c');
  }
  return cards.length === toBeat.count && rank > toBeat.rank;
}

/** Every play the player could make now, as sets of cards (passing aside). */
export function presidentLegalPlays(state: PresidentState, index: number): Card[][] {
  if (state.phase !== 'playing' || state.toAct !== index) return [];
  const byRank = new Map<number, Card[]>();
  for (const c of state.players[index].hand)
    byRank.set(presidentRank(c), [...(byRank.get(presidentRank(c)) ?? []), c]);
  const out: Card[][] = [];
  for (const group of byRank.values()) {
    for (let size = 1; size <= group.length; size++) {
      for (const combo of combinations(group, size))
        if (presidentCanPlay(state, index, combo)) out.push(combo);
    }
  }
  return out;
}

/** Whether the player may pass: anyone may, except the one who has to lead. */
export function presidentCanPass(state: PresidentState, index: number): boolean {
  return state.phase === 'playing' && state.toAct === index && state.trick.length > 0;
}

/** Next player after `from` (not included) who still holds cards, or -1. */
function nextInRound(players: PresidentPlayer[], from: number): number {
  const n = players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (players[i].hand.length > 0) return i;
  }
  return -1;
}

function endRound(state: PresidentState): PresidentState {
  const n = state.players.length;
  const last = state.players.findIndex((p) => p.hand.length > 0);
  const finished = last >= 0 ? [...state.finished, last] : state.finished;
  const order = presidentTitles(n);
  const titles: PresidentTitle[] = Array.from({ length: n }, () => 'neutre');
  finished.forEach((p, pos) => (titles[p] = order[pos]));
  // The last player's leftover cards go to the pile so the deck stays whole.
  const leftover = last >= 0 ? state.players[last].hand : [];
  return {
    ...state,
    phase: 'roundOver',
    toAct: -1,
    finished,
    titles,
    played: [...state.played, ...leftover],
    players: state.players.map((p, i) => ({
      ...p,
      hand: i === last ? [] : p.hand,
      passed: false,
      score: p.score + presidentPoints(titles[i], n),
    })),
  };
}

/** Clears the trick won by `winner`; the winner leads, or the next player still in if they went out. */
function closeTrick(state: PresidentState, winner: number): PresidentState {
  const leader = state.players[winner].hand.length > 0 ? winner : nextInRound(state.players, winner);
  return {
    ...state,
    trick: [],
    lastTrick: { winner, plays: state.trick },
    passes: 0,
    toAct: leader,
    players: state.players.map((p) => ({ ...p, passed: false })),
  };
}

/** Applies a move for player `index`; throws on anything the rules do not allow. */
export function presidentApply(state: PresidentState, index: number, move: PresidentMove): PresidentState {
  if (state.toAct !== index) throw new Error("Ce n'est pas ton tour");

  if (move.type === 'give') {
    const pending = state.pendingGives[0];
    if (state.phase !== 'exchange' || !pending || pending.from !== index) throw new Error('Rien à donner');
    const hand = state.players[index].hand;
    if (move.cards.length !== pending.count || new Set(move.cards).size !== move.cards.length)
      throw new Error(`Choisis ${pending.count} carte${pending.count > 1 ? 's' : ''}`);
    if (!move.cards.every((c) => hand.includes(c))) throw new Error("Tu n'as pas cette carte");
    const players = [...state.players];
    moveCards(players, index, pending.to, move.cards);
    const pendingGives = state.pendingGives.slice(1);
    const exchanges = [...state.exchanges, { from: index, to: pending.to, cards: presidentSort(move.cards) }];
    if (pendingGives.length > 0)
      return { ...state, players, pendingGives, exchanges, toAct: pendingGives[0].from };
    // Exchange over: the Trouduc leads the first trick.
    return {
      ...state,
      players,
      pendingGives,
      exchanges,
      phase: 'playing',
      toAct: state.titles.indexOf('trouduc'),
    };
  }

  if (state.phase !== 'playing') throw new Error('On ne joue pas en ce moment');

  if (move.type === 'pass') {
    if (!presidentCanPass(state, index)) throw new Error("Tu dois jouer : c'est toi qui commences");
    const players = state.players.map((p, i) => (i === index ? { ...p, passed: true } : p));
    const passes = state.passes + 1;
    const lastPlayer = state.trick[state.trick.length - 1].player;
    const inRound = players.filter((p) => p.hand.length > 0).length;
    // Everyone still holding cards, apart from the last player, has passed in a row.
    const needed = players[lastPlayer].hand.length > 0 ? inRound - 1 : inRound;
    const next = { ...state, players, passes, lastTrick: null };
    if (passes >= needed) return closeTrick(next, lastPlayer);
    return { ...next, toAct: nextInRound(players, index) };
  }

  if (!presidentCanPlay(state, index, move.cards)) throw new Error('Ce coup n’est pas permis');
  const players = state.players.map((p, i) =>
    i === index ? { ...p, hand: p.hand.filter((c) => !move.cards.includes(c)), passed: false } : p,
  );
  const cards = presidentSort(move.cards);
  let next: PresidentState = {
    ...state,
    players,
    trick: [...state.trick, { player: index, cards }],
    lastTrick: null,
    passes: 0,
    played: [...state.played, ...cards],
  };
  if (players[index].hand.length === 0) next = { ...next, finished: [...state.finished, index] };
  if (players.filter((p) => p.hand.length > 0).length <= 1) return endRound(next);
  // A 2 cannot be beaten: the trick ends at once.
  if (presidentRank(cards[0]) === 12) return closeTrick(next, index);
  return { ...next, toAct: nextInRound(players, index) };
}

/** Players sorted by total points, best first, sharing a place on equal points. */
export function presidentStandings(
  state: PresidentState,
): { index: number; name: string; score: number; place: number }[] {
  const sorted = state.players
    .map((p, index) => ({ index, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
  return sorted.map((e) => ({ ...e, place: sorted.findIndex((x) => x.score === e.score) + 1 }));
}

/**
 * What a robot does. It plays its cards in whole groups from the bottom up, keeps its 2s
 * and big sets for later, and spends them to take the lead back once its hand gets short.
 */
export function presidentBotMove(state: PresidentState, index: number, rng: Rng = secureRng): PresidentMove {
  const me = state.players[index];
  if (state.phase === 'exchange') {
    const pending = state.pendingGives[0];
    // Gives back its lowest cards.
    return { type: 'give', cards: presidentSort(me.hand).slice(0, pending.count) };
  }
  const groups = new Map<number, Card[]>();
  for (const c of presidentSort(me.hand))
    groups.set(presidentRank(c), [...(groups.get(presidentRank(c)) ?? []), c]);
  const ranks = [...groups.keys()].sort((a, b) => a - b);
  const toBeat = presidentToBeat(state);
  const handSize = me.hand.length;
  const danger = state.players.some((p, i) => i !== index && p.hand.length > 0 && p.hand.length <= 2);

  if (!toBeat) {
    if (state.round === 1 && state.played.length === 0) return { type: 'play', cards: groups.get(0)! };
    // Two groups left and one is the 2s: play the 2s to keep the lead, then go out.
    if (ranks.length === 2 && ranks[1] === 12) return { type: 'play', cards: groups.get(12)! };
    const low = ranks.find((r) => r !== 12) ?? 12;
    return { type: 'play', cards: groups.get(low)!.slice(0, 4) };
  }

  const options: { rank: number; breaks: number }[] = [];
  for (const r of ranks) {
    const size = groups.get(r)!.length;
    if (r > toBeat.rank && size >= toBeat.count) options.push({ rank: r, breaks: size - toBeat.count });
  }
  if (options.length === 0) return { type: 'pass' };
  const short = handSize <= 5 || danger;
  const pick = (o: { rank: number }) => ({
    type: 'play' as const,
    cards: groups.get(o.rank)!.slice(0, toBeat.count),
  });

  // Going out right away is always good.
  if (options.some((o) => o.breaks === 0 && handSize === toBeat.count)) return pick(options[0]);
  const clean = options.filter((o) => o.breaks === 0 && o.rank !== 12);
  if (clean.length > 0) {
    const o = clean[0];
    // Now and then, hold back an ace while the hand is still big.
    if (o.rank === 11 && !short && handSize > 8 && rng(100) < 30) return { type: 'pass' };
    return pick(o);
  }
  const twos = options.find((o) => o.rank === 12);
  if (twos && (short || (twos.breaks === 0 && handSize <= 8))) return pick(twos);
  // Breaking a set: only a pair, or anything once the hand is short.
  const broken = options.find(
    (o) => o.rank !== 12 && (short || (o.breaks === 1 && toBeat.count === 1 && handSize <= 9)),
  );
  if (broken) return pick(broken);
  return { type: 'pass' };
}

/* ------------------------------------------------------------------ online */

/** Numbers of rounds offered when creating an online table. */
export const PRESIDENT_ROUND_CHOICES = [3, 5, 7, 10];
export const PRESIDENT_DEFAULT_ROUNDS = 5;

/** Stands for a card the viewer cannot see (another player's hand, a private exchange). */
export const PRESIDENT_HIDDEN: Card = '??';

/**
 * What one seat sees of an online game: the same shape as the game itself, except that the
 * cards it may not see are replaced by `PRESIDENT_HIDDEN` (so hand sizes stay right).
 */
export type PresidentView = PresidentState & {
  /** Rounds in the game; it ends after this one. */
  rounds: number;
};

const hide = (cards: Card[]) => cards.map(() => PRESIDENT_HIDDEN);

/** Removes from a game what `seat` could not see at a real table (null: a spectator). */
export function presidentRedact(state: PresidentState, seat: number | null, rounds: number): PresidentView {
  return {
    ...state,
    rounds,
    players: state.players.map((p, i) => (i === seat ? p : { ...p, hand: hide(p.hand) })),
    // The pile is face down once a trick is over; only its size matters.
    played: hide(state.played),
    // Only the two players of an exchange know which cards changed hands.
    exchanges: state.exchanges.map((e) =>
      e.from === seat || e.to === seat ? e : { ...e, cards: hide(e.cards) },
    ),
  };
}
