import type { HandView } from './game.ts';

/** What one player got out of a finished hand, for their statistics. */
export interface PlayerOutcome {
  id: string;
  /** Chips won or lost over the hand. */
  net: number;
  /** Whether this player took all or part of a pot. */
  won: boolean;
  /** Biggest pot this player took in the hand, or 0. */
  bestPot: number;
}

/** Each player's result in a finished hand. */
export function handOutcomes(hand: HandView): PlayerOutcome[] {
  if (hand.street !== 'finished') throw new Error("La main n'est pas finie");
  return hand.players.map((p) => {
    const pots = hand.pots.filter((pot) => pot.winners.includes(p.id));
    // Hands dealt before startStack existed: count the even share of each pot won.
    const won = pots.reduce((s, pot) => s + Math.floor(pot.amount / pot.winners.length), 0);
    const net = p.startStack === undefined ? won - p.totalBet : p.stack - p.startStack;
    return {
      id: p.id,
      net,
      won: pots.length > 0,
      bestPot: pots.reduce((m, pot) => Math.max(m, pot.amount), 0),
    };
  });
}
