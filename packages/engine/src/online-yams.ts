import type { Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import { type YamsMove, type YamsState, yamsApply, yamsBotMove, yamsNewGame, yamsRanking } from './yams.ts';

/** Nothing is hidden at Yams: everyone sees the same dice and grids. */
export const yamsOnline: OnlineGame<YamsState> = {
  minPlayers: 1,
  maxPlayers: 6,
  options: () => ({}),
  start: (seats: OnlineSeat[]) => yamsNewGame(seats.map((s) => ({ name: s.name, bot: s.bot }))),
  actors: (state) => (state.finished ? [] : [state.current]),
  apply(state, seat, move, rng: Rng) {
    if (state.finished) throw new Error('La partie est finie.');
    if (seat !== state.current) throw new Error('Ce n’est pas ton tour.');
    const m = move as YamsMove;
    if (!m || !['roll', 'toggle', 'score'].includes(m.type)) throw new Error('Coup inconnu.');
    return yamsApply(state, m, rng);
  },
  auto: (state) => yamsBotMove(state),
  betweenRounds: () => false,
  nextRound: (state) => state,
  over: (state) => state.finished,
  winners: (state) => yamsRanking(state).filter((r) => r.place === 1).map((r) => Number(r.id.slice(1))),
  view: (state) => state,
};
