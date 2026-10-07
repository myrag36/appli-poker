import type { Rng } from './cards.ts';

/**
 * Yams (French Yahtzee): 5 dice, up to 3 rolls per turn, 13 boxes to fill per player.
 * Pure and immutable: every move returns a new state; dice come from an injected Rng.
 */

export type YamsBox =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'brelan'
  | 'carre'
  | 'full'
  | 'petiteSuite'
  | 'grandeSuite'
  | 'yams'
  | 'chance';

export const YAMS_UPPER_BOXES: readonly YamsBox[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const YAMS_LOWER_BOXES: readonly YamsBox[] = [
  'brelan',
  'carre',
  'full',
  'petiteSuite',
  'grandeSuite',
  'yams',
  'chance',
];
export const YAMS_BOXES: readonly YamsBox[] = [...YAMS_UPPER_BOXES, ...YAMS_LOWER_BOXES];

export const YAMS_BOX_LABELS: Record<YamsBox, string> = {
  ones: 'As (1)',
  twos: 'Deux',
  threes: 'Trois',
  fours: 'Quatre',
  fives: 'Cinq',
  sixes: 'Six',
  brelan: 'Brelan',
  carre: 'Carré',
  full: 'Full',
  petiteSuite: 'Petite suite',
  grandeSuite: 'Grande suite',
  yams: 'Yams',
  chance: 'Chance',
};

export const YAMS_DICE = 5;
export const YAMS_ROLLS = 3;
export const YAMS_BONUS_THRESHOLD = 63;
export const YAMS_BONUS = 35;
export const YAMS_MAX_PLAYERS = 6;

export type YamsScores = Partial<Record<YamsBox, number>>;

export interface YamsPlayer {
  id: string;
  name: string;
  bot: boolean;
  scores: YamsScores;
}

export interface YamsState {
  players: YamsPlayer[];
  /** Index of the player whose turn it is. */
  current: number;
  /** The five dice, 1..6; 0 before the first roll of a turn. */
  dice: number[];
  /** Which dice are kept aside for the next roll. */
  held: boolean[];
  /** Rolls still allowed this turn (3 at the start of a turn). */
  rollsLeft: number;
  /** Increases at every roll, so the screen knows when to animate the dice. */
  rollCount: number;
  /** The box filled by the previous move, if it was a score. */
  lastScore: { player: number; box: YamsBox; points: number } | null;
  finished: boolean;
}

export type YamsMove = { type: 'roll' } | { type: 'toggle'; index: number } | { type: 'score'; box: YamsBox };

const FACE: Record<string, number> = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };

/** Count of each face, index 1..6. */
function counts(dice: readonly number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}

function hasRun(c: number[], from: number, length: number): boolean {
  for (let f = from; f < from + length; f++) if (c[f] === 0) return false;
  return true;
}

/** Points the five dice are worth in a box (0 when they do not fit). */
export function yamsScoreBox(dice: readonly number[], box: YamsBox): number {
  if (dice.length !== YAMS_DICE || dice.some((d) => d < 1 || d > 6)) return 0;
  const c = counts(dice);
  const sum = dice.reduce((s, d) => s + d, 0);
  const max = Math.max(...c);
  switch (box) {
    case 'ones':
    case 'twos':
    case 'threes':
    case 'fours':
    case 'fives':
    case 'sixes':
      return c[FACE[box]] * FACE[box];
    case 'brelan':
      return max >= 3 ? sum : 0;
    case 'carre':
      return max >= 4 ? sum : 0;
    case 'full':
      // A Yams also counts as a full.
      return max === 5 || (c.includes(3) && c.includes(2)) ? 25 : 0;
    case 'petiteSuite':
      return hasRun(c, 1, 4) || hasRun(c, 2, 4) || hasRun(c, 3, 4) ? 30 : 0;
    case 'grandeSuite':
      return hasRun(c, 1, 5) || hasRun(c, 2, 5) ? 40 : 0;
    case 'yams':
      return max === 5 ? 50 : 0;
    case 'chance':
      return sum;
  }
}

export function yamsUpperTotal(scores: YamsScores): number {
  return YAMS_UPPER_BOXES.reduce((s, b) => s + (scores[b] ?? 0), 0);
}

export function yamsBonus(scores: YamsScores): number {
  return yamsUpperTotal(scores) >= YAMS_BONUS_THRESHOLD ? YAMS_BONUS : 0;
}

export function yamsLowerTotal(scores: YamsScores): number {
  return YAMS_LOWER_BOXES.reduce((s, b) => s + (scores[b] ?? 0), 0);
}

export function yamsTotal(scores: YamsScores): number {
  return yamsUpperTotal(scores) + yamsBonus(scores) + yamsLowerTotal(scores);
}

export function yamsOpenBoxes(scores: YamsScores): YamsBox[] {
  return YAMS_BOXES.filter((b) => scores[b] === undefined);
}

export function yamsNewGame(players: { name: string; bot?: boolean }[]): YamsState {
  if (players.length < 1 || players.length > YAMS_MAX_PLAYERS) throw new Error('De 1 à 6 joueurs.');
  return {
    players: players.map((p, i) => ({ id: `p${i}`, name: p.name, bot: !!p.bot, scores: {} })),
    current: 0,
    dice: [0, 0, 0, 0, 0],
    held: [false, false, false, false, false],
    rollsLeft: YAMS_ROLLS,
    rollCount: 0,
    lastScore: null,
    finished: false,
  };
}

export function yamsLegalMoves(state: YamsState): YamsMove[] {
  if (state.finished) return [];
  const moves: YamsMove[] = [];
  if (state.rollsLeft > 0 && !state.held.every(Boolean)) moves.push({ type: 'roll' });
  if (state.rollsLeft > 0 && state.rollsLeft < YAMS_ROLLS) {
    for (let i = 0; i < YAMS_DICE; i++) moves.push({ type: 'toggle', index: i });
  }
  if (state.rollsLeft < YAMS_ROLLS) {
    for (const box of yamsOpenBoxes(state.players[state.current].scores)) moves.push({ type: 'score', box });
  }
  return moves;
}

export function yamsApply(state: YamsState, move: YamsMove, rng: Rng): YamsState {
  if (state.finished) throw new Error('La partie est finie.');
  switch (move.type) {
    case 'roll': {
      if (state.rollsLeft <= 0) throw new Error('Plus de lancer ce tour-ci.');
      if (state.held.every(Boolean)) throw new Error('Tous les dés sont gardés.');
      const dice = state.dice.map((d, i) => (state.held[i] ? d : rng(6) + 1));
      return {
        ...state,
        dice,
        rollsLeft: state.rollsLeft - 1,
        rollCount: state.rollCount + 1,
        lastScore: null,
      };
    }
    case 'toggle': {
      if (state.rollsLeft === YAMS_ROLLS) throw new Error('Lance les dés d’abord.');
      if (state.rollsLeft === 0) throw new Error('Plus de lancer : choisis une case.');
      if (!Number.isInteger(move.index) || move.index < 0 || move.index >= YAMS_DICE)
        throw new Error('Dé inconnu.');
      return { ...state, held: state.held.map((h, i) => (i === move.index ? !h : h)) };
    }
    case 'score': {
      if (state.rollsLeft === YAMS_ROLLS) throw new Error('Lance les dés d’abord.');
      const player = state.players[state.current];
      if (!YAMS_BOXES.includes(move.box)) throw new Error('Case inconnue.');
      if (player.scores[move.box] !== undefined) throw new Error('Case déjà remplie.');
      const points = yamsScoreBox(state.dice, move.box);
      const players = state.players.map((p, i) =>
        i === state.current ? { ...p, scores: { ...p.scores, [move.box]: points } } : p,
      );
      const finished = players.every((p) => yamsOpenBoxes(p.scores).length === 0);
      return {
        ...state,
        players,
        current: finished ? state.current : (state.current + 1) % players.length,
        dice: [0, 0, 0, 0, 0],
        held: [false, false, false, false, false],
        rollsLeft: YAMS_ROLLS,
        lastScore: { player: state.current, box: move.box, points },
        finished,
      };
    }
  }
}

export interface YamsRankEntry {
  id: string;
  name: string;
  total: number;
  /** 1 for the best total; tied players share the same place. */
  place: number;
}

export function yamsRanking(state: YamsState): YamsRankEntry[] {
  const totals = state.players.map((p) => ({ id: p.id, name: p.name, total: yamsTotal(p.scores) }));
  return totals
    .map((t) => ({ ...t, place: 1 + totals.filter((o) => o.total > t.total).length }))
    .sort((a, b) => a.place - b.place);
}

// ---------------------------------------------------------------------------
// Robot

/** Roughly what each box is worth on average: using a box costs this much. */
const BASELINE: Record<YamsBox, number> = {
  ones: 2,
  twos: 5,
  threes: 8,
  fours: 11,
  fives: 13,
  sixes: 16,
  brelan: 17,
  carre: 8,
  full: 16,
  petiteSuite: 20,
  grandeSuite: 14,
  yams: 10,
  chance: 22,
};

/** How good it is to put these dice in this box now, given what is already filled. */
function boxValue(dice: readonly number[], box: YamsBox, scores: YamsScores): number {
  const points = yamsScoreBox(dice, box);
  let value = points - BASELINE[box];
  const face = FACE[box];
  if (face) {
    const upper = yamsUpperTotal(scores);
    if (upper < YAMS_BONUS_THRESHOLD) {
      // Three of a face keeps the bonus on track; above helps, below hurts.
      value += (points - 3 * face) * 0.8;
      if (upper + points >= YAMS_BONUS_THRESHOLD) value += YAMS_BONUS * 0.8;
    }
  }
  return value;
}

function bestBox(dice: readonly number[], scores: YamsScores): { box: YamsBox; value: number } {
  let best: { box: YamsBox; value: number } | null = null;
  for (const box of yamsOpenBoxes(scores)) {
    const value = boxValue(dice, box, scores);
    if (!best || value > best.value) best = { box, value };
  }
  if (!best) throw new Error('Aucune case libre.');
  return best;
}

/** A multiset of dice as one number: the count of each face in base 7. */
function keyOf(c: readonly number[]): number {
  let k = 0;
  for (let f = 6; f >= 1; f--) k = k * 7 + c[f];
  return k;
}

/**
 * For each number of rerolled dice, the distinct results (as face counts) with their probability.
 * Index 0 is the "reroll nothing" case.
 */
const REROLLS: { counts: number[]; p: number }[][] = [];
for (let n = 0; n <= YAMS_DICE; n++) {
  const byKey = new Map<number, { counts: number[]; p: number }>();
  const total = 6 ** n;
  for (let seq = 0; seq < total; seq++) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (let x = seq, i = 0; i < n; i++, x = Math.floor(x / 6)) c[(x % 6) + 1]++;
    const k = keyOf(c);
    const e = byKey.get(k);
    if (e) e.p += 1 / total;
    else byKey.set(k, { counts: c, p: 1 / total });
  }
  REROLLS.push([...byKey.values()]);
}
/** Every possible hand of five dice, by key. */
const HANDS = REROLLS[YAMS_DICE].map(({ counts }) => {
  const dice: number[] = [];
  for (let f = 1; f <= 6; f++) for (let i = 0; i < counts[f]; i++) dice.push(f);
  return { key: keyOf(counts), dice };
});

const tables = new Map<string, Map<number, number>>();
/** Value of the best open box for every possible hand, for one score sheet (cached). */
function valueTable(scores: YamsScores): Map<number, number> {
  const id = JSON.stringify(YAMS_BOXES.map((b) => scores[b] ?? null));
  let table = tables.get(id);
  if (!table) {
    if (tables.size > 200) tables.clear();
    table = new Map(HANDS.map((h) => [h.key, bestBox(h.dice, scores).value]));
    tables.set(id, table);
  }
  return table;
}

/**
 * Which dice the robot keeps before its next roll: for each way to hold dice it computes the exact
 * average value of its best box after one more roll, and keeps the best set.
 * Deterministic, so it never changes its mind while toggling dice one by one.
 */
export function yamsBotHolds(dice: readonly number[], scores: YamsScores): boolean[] {
  const table = valueTable(scores);
  let best = { value: -Infinity, mask: 31 };
  const seen = new Set<number>();
  for (let mask = 31; mask >= 0; mask--) {
    const kept = [0, 0, 0, 0, 0, 0, 0];
    let n = 0;
    dice.forEach((d, i) => {
      if (mask & (1 << i)) kept[d]++;
      else n++;
    });
    const keptKey = keyOf(kept);
    if (seen.has(keptKey)) continue;
    seen.add(keptKey);
    let value = 0;
    for (const o of REROLLS[n]) value += o.p * table.get(keptKey + keyOf(o.counts))!;
    if (value > best.value + 1e-9) best = { value, mask };
  }
  return dice.map((_, i) => !!(best.mask & (1 << i)));
}

/** The robot's next move, one step at a time (roll, hold one die, roll again, score). */
export function yamsBotMove(state: YamsState): YamsMove {
  if (state.finished) throw new Error('La partie est finie.');
  const scores = state.players[state.current].scores;
  if (state.rollsLeft === YAMS_ROLLS) return { type: 'roll' };
  if (state.rollsLeft > 0) {
    const want = yamsBotHolds(state.dice, scores);
    if (!want.every(Boolean)) {
      const i = want.findIndex((h, k) => h !== state.held[k]);
      return i >= 0 ? { type: 'toggle', index: i } : { type: 'roll' };
    }
  }
  return { type: 'score', box: bestBox(state.dice, scores).box };
}
