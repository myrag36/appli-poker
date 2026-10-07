import type { Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import {
  type BjState,
  type BjTableView,
  BJ_MAX_SEATS,
  bjActivePlayers,
  bjApply,
  bjBotBet,
  bjBotMove,
  bjIsOver,
  bjMinBet,
  bjNewGame,
  bjNextRound,
  bjRanking,
  bjPlaceBet,
  bjTableView,
} from './blackjack.ts';

/** Chips each player may start with at an online table. */
export const BJ_ONLINE_STACKS = [500, 1000, 2000];
export const BJ_ONLINE_DEFAULT_STACK = 1000;

/** The engine's state, plus the starting chips (for the final ranking). */
export interface BjOnlineState extends BjState {
  startStack: number;
}

const PLAY_MOVES = ['hit', 'stand', 'double', 'split'];

/** Index of a player in seat order (engine players are the seats, in the same order). */
function seatOfPlayer(state: BjOnlineState, playerId: string): number {
  return state.players.findIndex((p) => p.id === playerId);
}

function actors(state: BjOnlineState): number[] {
  if (state.phase === 'betting') {
    return bjActivePlayers(state)
      .filter((p) => state.bets[p.id] === undefined)
      .map((p) => seatOfPlayer(state, p.id));
  }
  if (state.phase === 'playing' && state.turn) {
    return [seatOfPlayer(state, state.seats[state.turn.seat].playerId)];
  }
  return [];
}

/**
 * Everyone plays against the dealer: all players bet at the same time, then each hand is played
 * in seat order. Every player's cards are face up, as at a real table; only the shoe and the
 * dealer's hole card are hidden.
 */
export const blackjackOnline: OnlineGame<BjOnlineState> = {
  minPlayers: 1,
  maxPlayers: BJ_MAX_SEATS,
  options(raw) {
    const stack = (raw as { stack?: unknown } | null)?.stack ?? BJ_ONLINE_DEFAULT_STACK;
    if (typeof stack !== 'number' || !BJ_ONLINE_STACKS.includes(stack)) {
      throw new Error('Jetons de départ : 500, 1000 ou 2000');
    }
    return { stack };
  },
  start(seats: OnlineSeat[], options, rng: Rng) {
    const stack = blackjackOnline.options(options).stack as number;
    const state = bjNewGame(
      { players: seats.map((s) => ({ id: s.id, name: s.name, bot: s.bot })), stack },
      rng,
    );
    return { ...state, startStack: stack };
  },
  actors,
  apply(state, seat, move, rng) {
    const player = state.players[seat];
    if (!player) throw new Error('Place inconnue');
    const m = move as { type?: unknown; amount?: unknown } | null;
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') throw new Error('Coup inconnu.');
    if (bjIsOver(state)) throw new Error('La partie est finie.');
    if (m.type === 'bet') {
      if (state.phase !== 'betting') throw new Error("Ce n'est pas le moment de miser.");
      if (!actors(state).includes(seat)) throw new Error('Tu as déjà misé.');
      if (typeof m.amount !== 'number') throw new Error('Mise invalide.');
      return { ...bjPlaceBet(state, player.id, m.amount, rng), startStack: state.startStack };
    }
    if (!PLAY_MOVES.includes(m.type)) throw new Error('Coup inconnu.');
    if (state.phase !== 'playing') throw new Error("Ce n'est pas le moment de jouer.");
    if (!actors(state).includes(seat)) throw new Error('Ce n’est pas ton tour.');
    const type = m.type as 'hit' | 'stand' | 'double' | 'split';
    return { ...bjApply(state, { type }, rng), startStack: state.startStack };
  },
  auto(state, seat) {
    const player = state.players[seat];
    if (state.phase === 'betting') {
      return { type: 'bet', amount: player.bot ? bjBotBet(player.stack) : bjMinBet(player.stack) };
    }
    // A person who let their time run out stands; a robot follows basic strategy.
    return player.bot ? bjBotMove(state) : { type: 'stand' };
  },
  betweenRounds: (state) => state.phase === 'settled' && !bjIsOver(state),
  nextRound: (state) => ({ ...bjNextRound(state), startStack: state.startStack }),
  over: (state) => bjIsOver(state),
  winners: (state) =>
    bjRanking(state)
      .filter((r) => r.place === 1)
      .map((r) => state.players.findIndex((p) => p.id === r.id)),
  // Nothing at the table is private to one player: everyone sees the same view.
  view: (state): BjTableView => bjTableView(state, state.startStack),
};
