import type { Rng } from './cards.ts';

/**
 * Perudo (dés menteurs, Liar's Dice): every player hides 5 dice under a cup. In turn, players
 * bid on how many dice of a face there are on the whole table, counting the 1s ("Pacos") as
 * wild. The next player raises the bid, or calls "Dudo !" (you lie) and everyone shows their
 * dice: whoever was wrong loses a die. With the Calza option, a player may also call the bid
 * exact: right, they win a die back; wrong, they lose one. The last player with dice wins.
 *
 * Pure and immutable: every move returns a new state; dice come from an injected Rng.
 */

export const PERUDO_DICE = 5;
export const PERUDO_MIN_PLAYERS = 2;
export const PERUDO_MAX_PLAYERS = 6;
/** The face of the Pacos, the wild dice. */
export const PACO = 1;

export interface PerudoBid {
  quantity: number;
  /** 1 (Paco) to 6. */
  face: number;
}

export interface PerudoPlayer {
  id: string;
  name: string;
  /** Dice left; 0 once out of the game. */
  count: number;
  /**
   * The dice rolled this round, sorted. During the reveal they stay as they were rolled,
   * even for the player who just lost one. 0 is a die someone else hides (online views).
   */
  dice: number[];
}

export interface PerudoChallenge {
  type: 'dudo' | 'calza';
  caller: number;
  bidder: number;
  bid: PerudoBid;
  /** How many dice showed the face, Pacos included. */
  actual: number;
  /** Who lost a die (null when a Calza was right). */
  loser: number | null;
  /** Who won a die back with a right Calza. */
  gainer: number | null;
  /** The loser lost their last die. */
  eliminated: boolean;
}

export type PerudoPhase = 'bidding' | 'reveal' | 'over';

export interface PerudoState {
  players: PerudoPlayer[];
  phase: PerudoPhase;
  /** Whose turn it is; during the reveal, who will start the next round. */
  current: number;
  /** The bid to beat, and who made it. */
  bid: PerudoBid | null;
  bidder: number | null;
  /** Every bid of this round, in order. */
  bids: { seat: number; bid: PerudoBid }[];
  /** Calling a bid exact is allowed. */
  calza: boolean;
  round: number;
  /** Increases at every move, so screens know when to animate. */
  seq: number;
  /** The last Dudo or Calza, shown during the reveal and at the end. */
  challenge: PerudoChallenge | null;
  /** Seats in the order they were knocked out. */
  out: number[];
  winner: number | null;
}

export type PerudoMove =
  | { type: 'bid'; quantity: number; face: number }
  | { type: 'dudo' }
  | { type: 'calza' };

export interface PerudoOptions {
  calza?: boolean;
}

function roll(count: number, rng: Rng): number[] {
  return Array.from({ length: count }, () => 1 + rng(6)).sort((a, b) => a - b);
}

export function perudoNewGame(
  players: { id: string; name: string }[],
  rng: Rng,
  options: PerudoOptions = {},
): PerudoState {
  if (players.length < PERUDO_MIN_PLAYERS || players.length > PERUDO_MAX_PLAYERS)
    throw new Error('Le Perudo se joue de 2 à 6 joueurs.');
  return {
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      count: PERUDO_DICE,
      dice: roll(PERUDO_DICE, rng),
    })),
    phase: 'bidding',
    current: rng(players.length),
    bid: null,
    bidder: null,
    bids: [],
    calza: options.calza !== false,
    round: 1,
    seq: 0,
    challenge: null,
    out: [],
    winner: null,
  };
}

/** Dice still in play on the whole table. */
export function perudoTotalDice(state: PerudoState): number {
  return state.players.reduce((s, p) => s + p.count, 0);
}

export function perudoAlive(state: PerudoState): number[] {
  return state.players.flatMap((p, i) => (p.count > 0 ? [i] : []));
}

/** Dice of a hand that count for a face: the face itself, plus the Pacos for any other face. */
export function perudoMatches(dice: readonly number[], face: number): number {
  return dice.filter((d) => d === face || (face !== PACO && d === PACO)).length;
}

/** True when `next` is a legal bid after `prev` (null: the opening bid of a round). */
export function perudoIsRaise(prev: PerudoBid | null, next: PerudoBid): boolean {
  return perudoMinQuantity(prev, next.face) !== null && next.quantity >= perudoMinQuantity(prev, next.face)!;
}

/**
 * The smallest quantity that may be bid on a face after `prev`, or null when the face cannot
 * be bid (a round cannot open on Pacos). Going to Pacos halves the quantity (rounded up);
 * coming back from Pacos doubles it, plus one.
 */
export function perudoMinQuantity(prev: PerudoBid | null, face: number): number | null {
  if (!Number.isInteger(face) || face < 1 || face > 6) return null;
  if (!prev) return face === PACO ? null : 1;
  if (prev.face === PACO) return face === PACO ? prev.quantity + 1 : prev.quantity * 2 + 1;
  if (face === PACO) return Math.ceil(prev.quantity / 2);
  return face > prev.face ? prev.quantity : prev.quantity + 1;
}

/** Every face the player to move may bid, with its smallest quantity (within the dice in play). */
export function perudoBidOptions(state: PerudoState): { face: number; min: number }[] {
  const total = perudoTotalDice(state);
  const out: { face: number; min: number }[] = [];
  for (let face = 1; face <= 6; face++) {
    const min = perudoMinQuantity(state.bid, face);
    if (min !== null && min <= total) out.push({ face, min });
  }
  return out;
}

/** Calza: only with the option, on someone else's bid, and while at least 3 players remain. */
export function perudoCanCalza(state: PerudoState, seat: number): boolean {
  return (
    state.calza &&
    state.phase === 'bidding' &&
    state.bid !== null &&
    state.bidder !== seat &&
    seat === state.current &&
    perudoAlive(state).length >= 3
  );
}

function nextAlive(players: PerudoPlayer[], from: number): number {
  const n = players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (players[i].count > 0) return i;
  }
  return from;
}

export function perudoApply(state: PerudoState, seat: number, move: PerudoMove): PerudoState {
  if (state.phase === 'over') throw new Error('La partie est finie.');
  if (state.phase !== 'bidding') throw new Error('La manche est finie.');
  if (seat !== state.current) throw new Error('Ce n’est pas ton tour.');
  if (move.type === 'bid') {
    const bid = { quantity: move.quantity, face: move.face };
    if (!Number.isInteger(bid.quantity) || !Number.isInteger(bid.face) || bid.face < 1 || bid.face > 6)
      throw new Error('Enchère inconnue.');
    if (!state.bid && bid.face === PACO) throw new Error('On n’ouvre pas sur les Pacos.');
    if (bid.quantity < 1 || bid.quantity > perudoTotalDice(state))
      throw new Error('Il n’y a pas autant de dés.');
    if (!perudoIsRaise(state.bid, bid)) throw new Error('Il faut monter l’enchère.');
    return {
      ...state,
      bid,
      bidder: seat,
      bids: [...state.bids, { seat, bid }],
      current: nextAlive(state.players, seat),
      seq: state.seq + 1,
    };
  }
  if (move.type !== 'dudo' && move.type !== 'calza') throw new Error('Coup inconnu.');
  if (!state.bid || state.bidder === null) throw new Error('Il faut d’abord une enchère.');
  if (move.type === 'calza' && !perudoCanCalza(state, seat)) throw new Error('Pas de Calza ici.');
  const bid = state.bid;
  const actual = state.players.reduce((s, p) => s + (p.count > 0 ? perudoMatches(p.dice, bid.face) : 0), 0);
  let loser: number | null;
  let gainer: number | null = null;
  if (move.type === 'dudo') loser = actual >= bid.quantity ? seat : state.bidder;
  else if (actual === bid.quantity) {
    loser = null;
    gainer = seat;
  } else loser = seat;
  const players = state.players.map((p, i) =>
    i === loser
      ? { ...p, count: p.count - 1 }
      : i === gainer
        ? { ...p, count: Math.min(PERUDO_DICE, p.count + 1) }
        : p,
  );
  const eliminated = loser !== null && players[loser].count === 0;
  const out = eliminated ? [...state.out, loser!] : state.out;
  const challenge: PerudoChallenge = {
    type: move.type,
    caller: seat,
    bidder: state.bidder,
    bid,
    actual,
    loser,
    gainer,
    eliminated,
  };
  const alive = players.flatMap((p, i) => (p.count > 0 ? [i] : []));
  if (alive.length === 1)
    return { ...state, players, phase: 'over', challenge, out, winner: alive[0], seq: state.seq + 1 };
  // The loser starts the next round; if they are out, the next player still in does.
  const starter = loser === null ? seat : eliminated ? nextAlive(players, loser) : loser;
  return { ...state, players, phase: 'reveal', challenge, out, current: starter, seq: state.seq + 1 };
}

/** Everyone still in rolls their dice again, and the round starts with no bid. */
export function perudoNextRound(state: PerudoState, rng: Rng): PerudoState {
  if (state.phase !== 'reveal') throw new Error('La manche n’est pas finie.');
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, dice: roll(p.count, rng) })),
    phase: 'bidding',
    bid: null,
    bidder: null,
    bids: [],
    round: state.round + 1,
    seq: state.seq + 1,
    challenge: null,
  };
}

/** Players from first to last: the winner, then those knocked out last. */
export function perudoRanking(state: PerudoState): number[] {
  const alive = state.players
    .map((p, i) => ({ i, count: p.count }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((p) => p.i);
  return [...alive, ...[...state.out].reverse()];
}

// ---------------------------------------------------------------------------
// Probabilities and robots

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Chance that exactly k of n dice show a face of probability p. */
export function perudoExactly(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0;
  return choose(n, k) * p ** k * (1 - p) ** (n - k);
}

/** Chance that at least k of n dice show a face of probability p. */
export function perudoAtLeast(n: number, k: number, p: number): number {
  if (k <= 0) return 1;
  let s = 0;
  for (let i = k; i <= n; i++) s += perudoExactly(n, i, p);
  return Math.min(1, s);
}

/** How likely a bid is to hold, for a player who only knows their own dice. */
export function perudoBidChance(state: PerudoState, seat: number, bid: PerudoBid): number {
  const mine = state.players[seat].dice;
  const unknown = perudoTotalDice(state) - state.players[seat].count;
  const p = bid.face === PACO ? 1 / 6 : 1 / 3;
  return perudoAtLeast(unknown, bid.quantity - perudoMatches(mine, bid.face), p);
}

function exactChance(state: PerudoState, seat: number, bid: PerudoBid): number {
  const mine = state.players[seat].dice;
  const unknown = perudoTotalDice(state) - state.players[seat].count;
  const p = bid.face === PACO ? 1 / 6 : 1 / 3;
  return perudoExactly(unknown, bid.quantity - perudoMatches(mine, bid.face), p);
}

/**
 * A robot's move: it weighs how likely the bid on the table is from its own dice, the best
 * raise it could make, and sometimes bluffs a little. Also used for players out of time.
 */
export function perudoBotMove(state: PerudoState, seat: number, rng: Rng): PerudoMove {
  const noise = () => (rng(21) - 10) / 100;
  const me = state.players[seat];
  if (!state.bid) {
    // Opening: the face it holds most of (Pacos count), as many as it can reasonably expect.
    let face = 2;
    let best = -1;
    for (let f = 2; f <= 6; f++) {
      const m = perudoMatches(me.dice, f) + rng(2) * 0.5;
      if (m > best) {
        best = m;
        face = f;
      }
    }
    // Now and then a bluff on a face it does not hold.
    if (rng(6) === 0) face = 2 + rng(5);
    let quantity = 1;
    const target = 0.6 + noise();
    while (
      quantity < perudoTotalDice(state) &&
      perudoBidChance(state, seat, { quantity: quantity + 1, face }) >= target
    )
      quantity++;
    return { type: 'bid', quantity, face };
  }
  const current = perudoBidChance(state, seat, state.bid);
  let raise: { bid: PerudoBid; chance: number; score: number } | null = null;
  for (const { face, min } of perudoBidOptions(state)) {
    for (let q = min; q <= Math.min(min + 2, perudoTotalDice(state)); q++) {
      const bid = { quantity: q, face };
      const chance = perudoBidChance(state, seat, bid);
      // Small raises keep the pressure on the next player without risking too much.
      const score = chance - 0.04 * (q - min) + noise() / 2;
      if (!raise || score > raise.score) raise = { bid, chance, score };
    }
  }
  if (perudoCanCalza(state, seat)) {
    const exact = exactChance(state, seat, state.bid);
    if (exact >= 0.42 + noise() / 2 && (!raise || raise.chance < 0.6)) return { type: 'calza' };
  }
  const doubt = 0.33 + noise();
  if (!raise || current < doubt - 0.15 || (current < doubt && raise.chance < 1 - current))
    return { type: 'dudo' };
  if (raise.chance < 0.25 && current < 0.5) return { type: 'dudo' };
  return { type: 'bid', ...raise.bid };
}
