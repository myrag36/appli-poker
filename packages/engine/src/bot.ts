import { type Card, type Rng, newDeck, secureRng } from './cards.ts';
import { compareScores } from './evaluator.ts';
import { type Action, type HandView, type Variant, bestHand, legalActions } from './game.ts';

/** Random games played out to estimate a hand's chances; enough for a steady guess, fast on a phone. */
const SIMULATIONS = 300;

/**
 * Share of the pot this hand wins on average against `opponents` random hands,
 * with the rest of the board dealt at random.
 */
export function equity(
  hole: Card[],
  board: Card[],
  opponents: number,
  rng: Rng = secureRng,
  variant: Variant = 'holdem',
): number {
  // Everyone holds as many cards as I do: 2 in Hold'em, 4 in Omaha.
  const size = hole.length;
  const known = new Set([...hole, ...board]);
  const rest = newDeck().filter((c) => !known.has(c));
  let total = 0;
  for (let n = 0; n < SIMULATIONS; n++) {
    // Partial shuffle: only the cards this run needs.
    const need = opponents * size + (5 - board.length);
    for (let i = 0; i < need; i++) {
      const j = i + rng(rest.length - i);
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const fullBoard = [...board, ...rest.slice(opponents * size, need)];
    const mine = bestHand(variant, hole, fullBoard).score;
    let best = 1;
    let ties = 0;
    for (let k = 0; k < opponents && best > 0; k++) {
      const theirs = bestHand(variant, rest.slice(size * k, size * (k + 1)), fullBoard).score;
      const c = compareScores(mine, theirs);
      if (c < 0) best = 0;
      else if (c === 0) ties++;
    }
    total += best / (ties + 1);
  }
  return total / SIMULATIONS;
}

/**
 * What a computer player does: it weighs its chances of winning against the price of
 * staying in, raises with strong hands, and bluffs now and then so it is not too easy to read.
 */
export function chooseBotAction(hand: HandView, playerId: string, rng: Rng = secureRng): Action {
  const legal = legalActions(hand, playerId);
  if (!legal) throw new Error("Ce n'est pas au tour de ce joueur");
  const me = hand.players.find((p) => p.id === playerId)!;
  const opponents = hand.players.filter((p) => p.id !== playerId && !p.folded).length;
  const chance = equity(me.hole, hand.board, opponents, rng, hand.variant);
  const pot = hand.players.reduce((s, p) => s + p.totalBet, 0);
  const toCall = legal.call;
  // The share of the final pot I must pay to stay in: calling pays off when my chances beat it.
  const price = toCall / (pot + toCall);
  const roll = rng(100) / 100;
  // Strength is judged against a fair share of the pot for this many players:
  // heads-up a strong hand wins about 72% of the time, against three players about 59%.
  const fair = 1 / (opponents + 1);
  const above = (margin: number) => fair + (1 - fair) * margin;

  const raise = (potShare: number): Action => {
    if (!legal.raise) return toCall > 0 ? { type: 'call' } : { type: 'check' };
    const target = me.bet + toCall + Math.round((pot + toCall) * potShare);
    const to = Math.max(legal.raise.min, Math.min(legal.raise.max, target));
    return to >= legal.raise.max ? { type: 'allin' } : { type: 'raise', to };
  };

  if (chance > above(0.45) || (chance > above(0.25) && roll < 0.5)) {
    return raise(chance > 0.85 ? 1 : 0.6);
  }
  if (toCall === 0) {
    // Nobody bet: sometimes bet a decent hand, or bluff.
    if (chance > above(0.12) && roll < 0.35) return raise(0.5);
    if (roll < 0.06) return raise(0.4);
    return { type: 'check' };
  }
  if (chance >= price + 0.03) return { type: 'call' };
  // A rare call or bluff raise with a weak hand, only when it is cheap.
  if (price < 0.2 && roll < 0.08) return roll < 0.03 ? raise(0.6) : { type: 'call' };
  return { type: 'fold' };
}

/** Names given to computer players, in order. */
export const BOT_NAMES = ['Robby', 'Bip', 'Zorg', 'Pixel', 'Turbo', 'Gizmo', 'Bolt', 'Nova'];

/** First robot name not already used at the table. */
export function botName(taken: string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  return BOT_NAMES.find((n) => !used.has(n.toLowerCase())) ?? `Robot ${taken.length + 1}`;
}
