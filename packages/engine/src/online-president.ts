import type { Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import {
  PRESIDENT_DEFAULT_ROUNDS,
  type PresidentMove,
  type PresidentState,
  presidentApply,
  presidentBotMove,
  presidentNewGame,
  presidentNextRound,
  presidentRedact,
  presidentStandings,
} from './president.ts';

export interface PresidentOnlineState {
  game: PresidentState;
  /** The game ends once this many rounds are over. */
  rounds: number;
}

/** A move as it comes from a client: checked field by field before the engine sees it. */
function checkMove(raw: unknown): PresidentMove {
  const m = raw as { type?: unknown; cards?: unknown } | null;
  if (!m || typeof m !== 'object') throw new Error('Coup inconnu.');
  if (m.type === 'pass') return { type: 'pass' };
  if (m.type !== 'play' && m.type !== 'give') throw new Error('Coup inconnu.');
  if (
    !Array.isArray(m.cards) ||
    m.cards.length === 0 ||
    m.cards.length > 4 ||
    !m.cards.every((c) => typeof c === 'string' && c.length === 2)
  )
    throw new Error('Choisis des cartes de ta main.');
  return { type: m.type, cards: [...(m.cards as string[])] };
}

const isOver = (s: PresidentOnlineState) => s.game.phase === 'roundOver' && s.game.round >= s.rounds;

/** Président: each player only sees their own hand; robots complete the table to 4. */
export const presidentOnline: OnlineGame<PresidentOnlineState> = {
  minPlayers: 3,
  maxPlayers: 8,
  fillTo: 4,
  options(raw) {
    const r = (raw as { rounds?: unknown } | null)?.rounds;
    if (r === undefined) return { rounds: PRESIDENT_DEFAULT_ROUNDS };
    if (typeof r !== 'number' || !Number.isInteger(r) || r < 1 || r > 20)
      throw new Error('Nombre de manches invalide');
    return { rounds: r };
  },
  start(seats: OnlineSeat[], options, rng: Rng) {
    const rounds = typeof options.rounds === 'number' ? options.rounds : PRESIDENT_DEFAULT_ROUNDS;
    return {
      game: presidentNewGame(
        seats.map((s) => ({ id: s.id, name: s.name })),
        rng,
      ),
      rounds,
    };
  },
  actors: (s) => (s.game.phase === 'roundOver' || s.game.toAct < 0 ? [] : [s.game.toAct]),
  apply(s, seat, move) {
    if (s.game.phase === 'roundOver') throw new Error('La manche est finie.');
    if (seat !== s.game.toAct) throw new Error('Ce n’est pas ton tour.');
    return { ...s, game: presidentApply(s.game, seat, checkMove(move)) };
  },
  auto: (s, seat, rng) => presidentBotMove(s.game, seat, rng),
  betweenRounds: (s) => s.game.phase === 'roundOver' && !isOver(s),
  nextRound(s, rng) {
    if (isOver(s)) throw new Error('La partie est finie.');
    return { ...s, game: presidentNextRound(s.game, rng) };
  },
  over: isOver,
  winners: (s) => presidentStandings(s.game).filter((r) => r.place === 1).map((r) => r.index),
  view: (s, seat) => presidentRedact(s.game, seat, s.rounds),
};
