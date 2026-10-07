import { type Rng, secureRng } from './cards.ts';

/**
 * Puissance 4 (Connect Four): 7 columns, 6 rows, tokens fall to the lowest free cell.
 * The first to line up 4 tokens (row, column or diagonal) wins the round; a full board is a draw.
 * Pure and immutable: every move returns a new state. A match is a series of rounds with a score.
 */

export const P4_COLS = 7;
export const P4_ROWS = 6;

/** Player 0 plays red, player 1 plays yellow. */
export type P4Player = 0 | 1;
export type P4Cell = P4Player | null;
export type P4Level = 'facile' | 'moyen' | 'difficile';

export const P4_LEVEL_LABELS: Record<P4Level, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

export interface P4State {
  /** board[col][row], row 0 at the bottom. */
  board: P4Cell[][];
  current: P4Player;
  /** Who played first this round; the next round starts with the other player. */
  starter: P4Player;
  /** Tokens played this round. */
  moves: number;
  lastMove: { col: number; row: number } | null;
  winner: P4Player | null;
  /** The four (or more) aligned cells of the winner, as [col, row]. */
  winLine: [number, number][] | null;
  draw: boolean;
  /** Rounds won by each player across the match, and drawn rounds. */
  scores: [number, number];
  draws: number;
  /** 1 for the first round of the match. */
  round: number;
}

export function p4NewGame(starter: P4Player = 0): P4State {
  return {
    board: Array.from({ length: P4_COLS }, () => Array<P4Cell>(P4_ROWS).fill(null)),
    current: starter,
    starter,
    moves: 0,
    lastMove: null,
    winner: null,
    winLine: null,
    draw: false,
    scores: [0, 0],
    draws: 0,
    round: 1,
  };
}

/** A fresh board for the next round, keeping the score; the other player starts. */
export function p4NextRound(state: P4State): P4State {
  if (!p4Finished(state)) throw new Error('La manche n’est pas finie');
  const starter: P4Player = state.starter === 0 ? 1 : 0;
  return {
    ...p4NewGame(starter),
    scores: state.scores,
    draws: state.draws,
    round: state.round + 1,
  };
}

export function p4Finished(state: P4State): boolean {
  return state.winner !== null || state.draw;
}

/** Row where a token dropped in this column would land, or -1 when the column is full. */
export function p4DropRow(board: P4Cell[][], col: number): number {
  const c = board[col];
  if (!c) return -1;
  for (let r = 0; r < P4_ROWS; r++) if (c[r] === null) return r;
  return -1;
}

export function p4LegalColumns(state: P4State): number[] {
  if (p4Finished(state)) return [];
  const cols: number[] = [];
  for (let c = 0; c < P4_COLS; c++) if (p4DropRow(state.board, c) >= 0) cols.push(c);
  return cols;
}

const DIRECTIONS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** The aligned cells through (col, row) when they make 4 or more of the same color, else null. */
export function p4WinLineAt(board: P4Cell[][], col: number, row: number): [number, number][] | null {
  const who = board[col]?.[row];
  if (who === null || who === undefined) return null;
  for (const [dc, dr] of DIRECTIONS) {
    const line: [number, number][] = [[col, row]];
    for (const sign of [1, -1]) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (c >= 0 && c < P4_COLS && r >= 0 && r < P4_ROWS && board[c][r] === who) {
        line.push([c, r]);
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (line.length >= 4) return line.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  return null;
}

/** Drops the current player's token in a column. */
export function p4Drop(state: P4State, col: number): P4State {
  if (p4Finished(state)) throw new Error('La manche est finie');
  if (!Number.isInteger(col) || col < 0 || col >= P4_COLS) throw new Error('Colonne inconnue');
  const row = p4DropRow(state.board, col);
  if (row < 0) throw new Error('Cette colonne est pleine');
  const board = state.board.map((c, i) => (i === col ? c.map((v, r) => (r === row ? state.current : v)) : c));
  const moves = state.moves + 1;
  const winLine = p4WinLineAt(board, col, row);
  const winner = winLine ? state.current : null;
  const draw = !winLine && moves === P4_COLS * P4_ROWS;
  const scores: [number, number] = [...state.scores];
  if (winner !== null) scores[winner]++;
  return {
    ...state,
    board,
    moves,
    lastMove: { col, row },
    current: winLine || draw ? state.current : state.current === 0 ? 1 : 0,
    winner,
    winLine,
    draw,
    scores,
    draws: state.draws + (draw ? 1 : 0),
  };
}

// ---------------------------------------------------------------------------
// Robot

/** Columns searched from the center outwards: central moves are usually better, and it speeds up pruning. */
const ORDER = [3, 2, 4, 1, 5, 0, 6];

/** Search depth (in tokens) of each level. */
const DEPTH: Record<P4Level, number> = { facile: 2, moyen: 4, difficile: 8 };

const WIN = 1_000_000;

/** Every line of 4 cells on the board, 4 indexes each into a flat col * ROWS + row array. */
const WINDOWS: Int8Array = (() => {
  const out: number[] = [];
  for (let c = 0; c < P4_COLS; c++)
    for (let r = 0; r < P4_ROWS; r++)
      for (const [dc, dr] of DIRECTIONS) {
        const ec = c + dc * 3;
        const er = r + dr * 3;
        if (ec < 0 || ec >= P4_COLS || er < 0 || er >= P4_ROWS) continue;
        for (let k = 0; k < 4; k++) out.push((c + dc * k) * P4_ROWS + (r + dr * k));
      }
  return Int8Array.from(out);
})();

/** A mutable copy of the board, quick to search: -1 empty, 0 or 1 a token. */
interface Search {
  cells: Int8Array;
  heights: Int8Array;
}

function toSearch(board: P4Cell[][]): Search {
  const cells = new Int8Array(P4_COLS * P4_ROWS).fill(-1);
  const heights = new Int8Array(P4_COLS);
  for (let c = 0; c < P4_COLS; c++)
    for (let r = 0; r < P4_ROWS; r++) {
      const v = board[c][r];
      if (v !== null) {
        cells[c * P4_ROWS + r] = v;
        heights[c] = r + 1;
      }
    }
  return { cells, heights };
}

function winsAt(s: Search, col: number, row: number, who: number): boolean {
  for (const [dc, dr] of DIRECTIONS) {
    let n = 1;
    for (const sign of [1, -1]) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (c >= 0 && c < P4_COLS && r >= 0 && r < P4_ROWS && s.cells[c * P4_ROWS + r] === who) {
        n++;
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (n >= 4) return true;
  }
  return false;
}

/** Would `who` win by dropping in this column? */
function winningDrop(s: Search, col: number, who: number): boolean {
  const row = s.heights[col];
  return row < P4_ROWS && winsAt(s, col, row, who);
}

/** Static value of a position for `who`: open lines of 2 and 3, and tokens in the center column. */
function evaluate(s: Search, who: number): number {
  const other = 1 - who;
  let score = 0;
  for (let r = 0; r < P4_ROWS; r++) {
    const v = s.cells[3 * P4_ROWS + r];
    if (v === who) score += 3;
    else if (v === other) score -= 3;
  }
  const cells = s.cells;
  for (let w = 0; w < WINDOWS.length; w += 4) {
    let mine = 0;
    let theirs = 0;
    for (let k = w; k < w + 4; k++) {
      const v = cells[WINDOWS[k]];
      if (v === who) mine++;
      else if (v === other) theirs++;
    }
    if (theirs === 0) score += mine === 3 ? 5 : mine === 2 ? 2 : 0;
    else if (mine === 0) score -= theirs === 3 ? 5 : theirs === 2 ? 2 : 0;
  }
  return score;
}

/** Negamax with alpha-beta: the value of the position for `who`, who is about to play. */
function negamax(s: Search, who: number, depth: number, alpha: number, beta: number, filled: number): number {
  if (filled === P4_COLS * P4_ROWS) return 0;
  // An immediate win ends the search right away (faster wins score higher).
  for (const c of ORDER) if (winningDrop(s, c, who)) return WIN + depth;
  // The opponent's immediate wins: two of them cannot both be blocked, one must be.
  let forced = -1;
  for (const c of ORDER)
    if (winningDrop(s, c, 1 - who)) {
      if (forced >= 0) return -(WIN + depth - 1);
      forced = c;
    }
  if (depth === 0) return evaluate(s, who);
  let best = -Infinity;
  for (const c of ORDER) {
    if (forced >= 0 && c !== forced) continue;
    const row = s.heights[c];
    if (row >= P4_ROWS) continue;
    s.cells[c * P4_ROWS + row] = who;
    s.heights[c] = row + 1;
    const value = -negamax(s, 1 - who, depth - 1, -beta, -alpha, filled + 1);
    s.cells[c * P4_ROWS + row] = -1;
    s.heights[c] = row;
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Score of every legal column for the player to move, searched `depth` tokens ahead. Scores within
 * `slack` of the best are exact; worse columns only get an upper bound, which is enough to rule them out.
 */
export function p4ColumnScores(state: P4State, depth: number, slack = 0): { col: number; score: number }[] {
  const s = toSearch(state.board);
  const who = state.current;
  const out: { col: number; score: number }[] = [];
  let best = -Infinity;
  for (const c of ORDER) {
    const row = s.heights[c];
    if (row >= P4_ROWS) continue;
    let score: number;
    if (winsAt(s, c, row, who)) score = WIN + depth;
    else {
      s.cells[c * P4_ROWS + row] = who;
      s.heights[c] = row + 1;
      const alpha = best - slack - 1;
      score = -negamax(s, 1 - who, depth - 1, -Infinity, -alpha, state.moves + 1);
      s.cells[c * P4_ROWS + row] = -1;
      s.heights[c] = row;
    }
    if (score > best) best = score;
    out.push({ col: c, score });
  }
  return out;
}

/**
 * The robot's column. Facile sees its own wins, usually blocks yours, and otherwise plays loosely;
 * Moyen searches 4 tokens ahead; Difficile 8, with alpha-beta pruning so it stays quick on a phone.
 */
export function p4BotMove(state: P4State, level: P4Level, rng: Rng = secureRng): number {
  const legal = p4LegalColumns(state);
  if (legal.length === 0) throw new Error('Aucun coup possible');
  const s = toSearch(state.board);
  const me = state.current;
  const win = legal.find((c) => winningDrop(s, c, me));
  if (win !== undefined) return win;

  if (level === 'facile') {
    const block = legal.find((c) => winningDrop(s, c, 1 - me));
    // A beginner sometimes misses your threat.
    if (block !== undefined && rng(4) !== 0) return block;
    // Otherwise a loose preference for the middle of the board.
    const weights = legal.map((c) => 4 - Math.abs(3 - c));
    let pick = rng(weights.reduce((a, b) => a + b, 0));
    for (let i = 0; i < legal.length; i++) {
      pick -= weights[i];
      if (pick < 0) return legal[i];
    }
    return legal[legal.length - 1];
  }

  // Moyen is less precise: any column close to the best will do, unless a win or a loss is in sight.
  const slack = level === 'moyen' ? 3 : 0;
  const scores = p4ColumnScores(state, DEPTH[level], slack);
  const best = Math.max(...scores.map((x) => x.score));
  const margin = Math.abs(best) > WIN / 2 ? 0 : slack;
  const good = scores.filter((x) => x.score >= best - margin).map((x) => x.col);
  return good[rng(good.length)];
}
