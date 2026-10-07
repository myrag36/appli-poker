import type { OnlineGame } from './online.ts';

const notYet = () => {
  throw new Error('Blackjack en ligne arrive bientôt.');
};

/** Placeholder until the online version of this game is written. */
export const blackjackOnline: OnlineGame<never> = {
  minPlayers: 1,
  maxPlayers: 8,
  options: notYet,
  start: notYet,
  actors: notYet,
  apply: notYet,
  auto: notYet,
  betweenRounds: notYet,
  nextRound: notYet,
  over: notYet,
  view: notYet,
};
