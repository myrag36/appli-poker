import type { Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import { type P4State, p4BotMove, p4Drop, p4Finished, p4NewGame, p4NextRound } from './puissance4.ts';

/** Number of rounds of an online match, and the choices offered when creating a table. */
export const P4_ONLINE_DEFAULT_ROUNDS = 3;
export const P4_ONLINE_ROUND_CHOICES = [1, 3, 5, 7];

export interface P4OnlineState {
  /** Seat 0 plays red (player 0), seat 1 plays yellow (player 1). */
  game: P4State;
  /** The match ends once this many rounds are over. */
  rounds: number;
}

const isOver = (s: P4OnlineState) => p4Finished(s.game) && s.game.round >= s.rounds;

/** Puissance 4: two players, nothing hidden; a robot takes the second seat if needed. */
export const puissance4Online: OnlineGame<P4OnlineState> = {
  minPlayers: 1,
  maxPlayers: 2,
  fillTo: 2,
  options(raw) {
    const r = (raw as { rounds?: unknown } | null)?.rounds;
    if (r === undefined) return { rounds: P4_ONLINE_DEFAULT_ROUNDS };
    if (typeof r !== 'number' || !Number.isInteger(r) || r < 1 || r > 9)
      throw new Error('Nombre de manches invalide');
    return { rounds: r };
  },
  start(seats: OnlineSeat[], options) {
    if (seats.length !== 2) throw new Error('Il faut deux joueurs');
    const rounds = typeof options.rounds === 'number' ? options.rounds : P4_ONLINE_DEFAULT_ROUNDS;
    return { game: p4NewGame(0), rounds };
  },
  actors: (s) => (p4Finished(s.game) ? [] : [s.game.current]),
  apply(s, seat, move) {
    if (p4Finished(s.game)) throw new Error('La manche est finie');
    if (seat !== s.game.current) throw new Error('Ce n’est pas ton tour.');
    const m = move as { type?: unknown; col?: unknown } | null;
    if (!m || m.type !== 'drop' || typeof m.col !== 'number') throw new Error('Coup inconnu.');
    return { ...s, game: p4Drop(s.game, m.col) };
  },
  auto: (s, _seat, rng: Rng) => ({ type: 'drop', col: p4BotMove(s.game, 'moyen', rng) }),
  betweenRounds: (s) => p4Finished(s.game) && !isOver(s),
  nextRound(s) {
    if (isOver(s)) throw new Error('La partie est finie.');
    return { ...s, game: p4NextRound(s.game) };
  },
  over: isOver,
  winners(s) {
    const [a, b] = s.game.scores;
    return a === b ? [0, 1] : [a > b ? 0 : 1];
  },
  view: (s) => s,
};
