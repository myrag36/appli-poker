import { type Card, rankValue, suitOf } from './cards.ts';

export const CATEGORY_NAMES = [
  'Hauteur',
  'Paire',
  'Double paire',
  'Brelan',
  'Quinte',
  'Couleur',
  'Full',
  'Carré',
  'Quinte flush',
] as const;

/** [category, ...tiebreak ranks]; compare lexicographically, higher wins. */
export type HandScore = number[];

export interface HandResult {
  score: HandScore;
  name: string;
  cards: Card[];
}

export function compareScores(a: HandScore, b: HandScore): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function straightHigh(sortedDistinctDesc: number[]): number {
  const v = sortedDistinctDesc.includes(14) ? [...sortedDistinctDesc, 1] : sortedDistinctDesc;
  for (let i = 0; i + 4 < v.length; i++) {
    if (v[i] - v[i + 4] === 4) return v[i];
  }
  return 0;
}

export function scoreFive(cards: Card[]): HandScore {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const distinct = [...new Set(values)];
  const straight = distinct.length === 5 ? straightHigh(distinct) : 0;

  if (straight && flush) return [8, straight];

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map((g) => g[1]).join('');
  const ranks = groups.map((g) => g[0]);

  if (shape === '41') return [7, ...ranks];
  if (shape === '32') return [6, ...ranks];
  if (flush) return [5, ...values];
  if (straight) return [4, straight];
  if (shape === '311') return [3, ...ranks];
  if (shape === '221') return [2, ...ranks];
  if (shape === '2111') return [1, ...ranks];
  return [0, ...values];
}

/** Best 5-card hand out of 5 to 7 cards. */
export function evaluate(cards: Card[]): HandResult {
  let best: HandResult | null = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const score = scoreFive(five);
            if (!best || compareScores(score, best.score) > 0) {
              best = { score, name: CATEGORY_NAMES[score[0]], cards: five };
            }
          }
  if (!best) throw new Error('evaluate needs at least 5 cards');
  return best;
}
