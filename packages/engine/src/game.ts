import { type Card, type Rng, newDeck, secureRng, shuffle } from './cards.ts';
import { type HandResult, compareScores, evaluate } from './evaluator.ts';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'finished';

export interface SeatInput {
  id: string;
  name: string;
  stack: number;
}

export interface PlayerState {
  id: string;
  name: string;
  stack: number;
  /** Chips put in on the current street. */
  bet: number;
  /** Chips put in during the whole hand. */
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  hole: Card[];
}

export interface PotResult {
  amount: number;
  winners: string[];
}

export interface HandState {
  players: PlayerState[];
  dealer: number;
  smallBlind: number;
  bigBlind: number;
  deck: Card[];
  board: Card[];
  street: Street;
  /** Index into players of who must act, or -1 when nobody can. */
  toAct: number;
  currentBet: number;
  lastRaiseSize: number;
  /** Players who still owe an action this street. */
  needsToAct: string[];
  /** Players who acted since the last full raise and may not re-raise. */
  actedSinceFullRaise: string[];
  pots: PotResult[];
  showdown: Record<string, HandResult>;
  log: string[];
}

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  /** Raise (or bet) so this player's street total becomes `to`. */
  | { type: 'raise'; to: number }
  | { type: 'allin' };

export interface LegalActions {
  fold: boolean;
  check: boolean;
  call: number;
  /** Minimum and maximum `to` for a raise, or null if raising is not allowed. */
  raise: { min: number; max: number } | null;
}

export interface StartOptions {
  seats: SeatInput[];
  dealer: number;
  smallBlind: number;
  bigBlind: number;
  rng?: Rng;
}

const nextIndex = (n: number, i: number) => (i + 1) % n;

function canAct(p: PlayerState) {
  return !p.folded && !p.allIn;
}

function commit(state: HandState, p: PlayerState, amount: number) {
  const paid = Math.min(amount, p.stack);
  p.stack -= paid;
  p.bet += paid;
  p.totalBet += paid;
  if (p.stack === 0) p.allIn = true;
  return paid;
}

/** Next seat after `from` (exclusive), going clockwise, that is in `ids`. */
function nextInList(state: HandState, from: number, ids: string[]): number {
  const n = state.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (ids.includes(state.players[i].id)) return i;
  }
  return -1;
}

export function startHand(opts: StartOptions): HandState {
  const seats = opts.seats.filter((s) => s.stack > 0);
  if (seats.length < 2) throw new Error('Il faut au moins 2 joueurs avec des jetons');
  const n = seats.length;
  const dealer = opts.dealer % n;
  const deck = shuffle(newDeck(), opts.rng ?? secureRng);

  const state: HandState = {
    players: seats.map((s) => ({
      ...s,
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      hole: [],
    })),
    dealer,
    smallBlind: opts.smallBlind,
    bigBlind: opts.bigBlind,
    deck,
    board: [],
    street: 'preflop',
    toAct: -1,
    currentBet: 0,
    lastRaiseSize: opts.bigBlind,
    needsToAct: [],
    actedSinceFullRaise: [],
    pots: [],
    showdown: {},
    log: [],
  };

  for (let round = 0; round < 2; round++) {
    for (let k = 1; k <= n; k++) state.players[(dealer + k) % n].hole.push(state.deck.pop()!);
  }

  // Heads-up, the dealer posts the small blind and acts first preflop.
  const sbIndex = n === 2 ? dealer : nextIndex(n, dealer);
  const bbIndex = nextIndex(n, sbIndex);
  commit(state, state.players[sbIndex], opts.smallBlind);
  commit(state, state.players[bbIndex], opts.bigBlind);
  state.currentBet = Math.max(...state.players.map((p) => p.bet));
  state.log.push(`${state.players[sbIndex].name} poste la petite blinde`);
  state.log.push(`${state.players[bbIndex].name} poste la grosse blinde`);

  const actors = state.players.filter(canAct);
  const lone = actors.length === 1 && actors[0].bet >= state.currentBet;
  state.needsToAct = lone ? [] : actors.map((p) => p.id);
  state.toAct = nextInList(state, bbIndex, state.needsToAct);
  return settle(state);
}

export function legalActions(state: HandState, playerId: string): LegalActions | null {
  if (state.street === 'finished' || state.toAct < 0) return null;
  const p = state.players[state.toAct];
  if (p.id !== playerId) return null;

  const toCall = Math.min(state.currentBet - p.bet, p.stack);
  const maxTo = p.bet + p.stack;
  const minTo = state.currentBet + state.lastRaiseSize;
  const othersCanRespond = state.players.some((o) => o.id !== p.id && canAct(o));
  const mayRaise =
    !state.actedSinceFullRaise.includes(p.id) && maxTo > state.currentBet && othersCanRespond;

  return {
    fold: toCall > 0,
    check: toCall === 0,
    call: toCall,
    raise: mayRaise ? { min: Math.min(minTo, maxTo), max: maxTo } : null,
  };
}

export function applyAction(prev: HandState, playerId: string, action: Action): HandState {
  const legal = legalActions(prev, playerId);
  if (!legal) throw new Error("Ce n'est pas ton tour");

  const state = structuredClone(prev);
  const p = state.players[state.toAct];
  const done = () => {
    state.needsToAct = state.needsToAct.filter((id) => id !== p.id);
    if (!state.actedSinceFullRaise.includes(p.id)) state.actedSinceFullRaise.push(p.id);
  };

  let a = action;
  if (a.type === 'allin') {
    a = legal.raise ? { type: 'raise', to: legal.raise.max } : { type: 'call' };
  }

  switch (a.type) {
    case 'fold':
      if (!legal.fold) throw new Error('Tu peux checker, pas besoin de te coucher');
      p.folded = true;
      state.log.push(`${p.name} se couche`);
      done();
      break;
    case 'check':
      if (!legal.check) throw new Error('Tu ne peux pas checker');
      state.log.push(`${p.name} checke`);
      done();
      break;
    case 'call':
      if (legal.call === 0) throw new Error('Rien à suivre, checke plutôt');
      commit(state, p, legal.call);
      state.log.push(`${p.name} suit ${legal.call}`);
      done();
      break;
    case 'raise': {
      if (!legal.raise) throw new Error('Relance impossible');
      const { min, max } = legal.raise;
      if (!Number.isInteger(a.to) || a.to < min || a.to > max) {
        throw new Error(`La relance doit être entre ${min} et ${max}`);
      }
      const raiseSize = a.to - state.currentBet;
      commit(state, p, a.to - p.bet);
      const full = raiseSize >= state.lastRaiseSize;
      state.log.push(`${p.name} ${state.currentBet === 0 ? 'mise' : 'relance à'} ${a.to}`);
      state.currentBet = a.to;
      if (full) {
        // A full raise reopens the betting for everyone.
        state.lastRaiseSize = raiseSize;
        state.actedSinceFullRaise = [p.id];
      } else if (!state.actedSinceFullRaise.includes(p.id)) {
        // A short all-in raise forces calls but does not reopen raising.
        state.actedSinceFullRaise.push(p.id);
      }
      state.needsToAct = state.players
        .filter((o) => o.id !== p.id && canAct(o) && o.bet < state.currentBet)
        .map((o) => o.id);
      break;
    }
  }

  state.toAct = nextInList(state, state.toAct, state.needsToAct);
  return settle(state);
}

/** Advance streets and resolve the hand while no player decision is pending. */
function settle(state: HandState): HandState {
  while (state.street !== 'finished') {
    const live = state.players.filter((p) => !p.folded);
    if (live.length === 1) {
      const total = state.players.reduce((s, p) => s + p.totalBet, 0);
      live[0].stack += total;
      state.pots = [{ amount: total, winners: [live[0].id] }];
      state.log.push(`${live[0].name} remporte ${total}`);
      state.street = 'finished';
      state.toAct = -1;
      break;
    }
    if (state.needsToAct.length > 0) {
      if (state.toAct < 0) state.toAct = nextInList(state, state.dealer, state.needsToAct);
      break;
    }
    if (state.street === 'river') {
      showdown(state);
      break;
    }
    dealNextStreet(state);
  }
  return state;
}

function dealNextStreet(state: HandState) {
  const order: Street[] = ['preflop', 'flop', 'turn', 'river'];
  state.street = order[order.indexOf(state.street) + 1];
  state.deck.pop(); // burn
  const count = state.street === 'flop' ? 3 : 1;
  for (let i = 0; i < count; i++) state.board.push(state.deck.pop()!);
  state.log.push(`${state.street} : ${state.board.join(' ')}`);

  for (const p of state.players) p.bet = 0;
  state.currentBet = 0;
  state.lastRaiseSize = state.bigBlind;
  state.actedSinceFullRaise = [];
  const actors = state.players.filter(canAct);
  state.needsToAct = actors.length >= 2 ? actors.map((p) => p.id) : [];
  state.toAct = nextInList(state, state.dealer, state.needsToAct);
}

function showdown(state: HandState) {
  const live = state.players.filter((p) => !p.folded);
  for (const p of live) state.showdown[p.id] = evaluate([...p.hole, ...state.board]);

  const levels = [...new Set(state.players.map((p) => p.totalBet))]
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  let prev = 0;
  let carry = 0;
  const n = state.players.length;
  // Odd chips go to the first winner clockwise from the dealer.
  const seatOrder = (id: string) =>
    (state.players.findIndex((p) => p.id === id) - state.dealer - 1 + n) % n;

  for (const level of levels) {
    const amount =
      carry +
      state.players.reduce((s, p) => s + Math.max(0, Math.min(p.totalBet, level) - prev), 0);
    prev = level;
    const eligible = live.filter((p) => p.totalBet >= level);
    if (eligible.length === 0) {
      carry = amount;
      continue;
    }
    carry = 0;
    let best = eligible[0];
    for (const p of eligible) {
      if (compareScores(state.showdown[p.id].score, state.showdown[best.id].score) > 0) best = p;
    }
    const winners = eligible
      .filter((p) => compareScores(state.showdown[p.id].score, state.showdown[best.id].score) === 0)
      .sort((a, b) => seatOrder(a.id) - seatOrder(b.id));
    const share = Math.floor(amount / winners.length);
    winners.forEach((w, i) => {
      w.stack += share + (i < amount % winners.length ? 1 : 0);
    });
    state.pots.push({ amount, winners: winners.map((w) => w.id) });
    state.log.push(
      `${winners.map((w) => w.name).join(' et ')} remporte ${amount} (${state.showdown[winners[0].id].name})`,
    );
  }
  state.street = 'finished';
  state.toAct = -1;
}

/** What one player is allowed to see: other hands stay hidden until showdown. */
export function viewFor(state: HandState, playerId: string) {
  const { deck, ...rest } = state;
  const reveal = state.street === 'finished' && Object.keys(state.showdown).length > 0;
  return {
    ...rest,
    players: state.players.map((p) => ({
      ...p,
      hole: p.id === playerId || (reveal && !p.folded) ? p.hole : [],
    })),
  };
}
