import { type Rng, secureRng } from './cards.ts';

/**
 * Dames (international draughts, FMJD rules) on a 10 x 10 board.
 *
 * Only the 50 dark squares are used, numbered 0 to 49 here (1 to 50 in the usual notation): square 0
 * is the second cell of the top row, row by row down to square 49 in the bottom row. White (player 0)
 * starts on the bottom four rows and moves first, upwards; Black (player 1) starts on the top four rows.
 *
 * - Men move one square diagonally forward, and capture forward and backward by jumping over an
 *   adjacent enemy piece onto the empty square just behind it.
 * - Kings fly: they move any distance along a diagonal, and capture an enemy piece at any distance,
 *   landing on any empty square beyond it.
 * - Capturing is mandatory, and the sequence that takes the most pieces must be played (a king counts
 *   as one piece). Pieces are removed only once the whole sequence is over: they cannot be jumped twice
 *   and keep blocking the way meanwhile.
 * - A man becomes a king only when its move ends on the far row: passing through it during a capture
 *   that goes on does not promote it.
 * - A player with no piece or no legal move loses. Draws: the same position for the third time; 25
 *   moves each with only kings moved and nothing captured; and the short endgames (a lone king against
 *   three pieces including a king: 16 moves each; against two pieces or fewer: 5 moves each).
 *
 * Pure and immutable: every move returns a new state.
 */

export const DAMES_SIZE = 10;
export const DAMES_SQUARES = 50;

/** Player 0 plays white (bottom, moves first), player 1 black. */
export type DamesPlayer = 0 | 1;
/** '.' empty, 'w' white man, 'W' white king, 'b' black man, 'B' black king. */
export type DamesPiece = '.' | 'w' | 'W' | 'b' | 'B';
export type DamesLevel = 'facile' | 'moyen' | 'difficile';

export const DAMES_LEVEL_LABELS: Record<DamesLevel, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

/** Why a game ended. */
export type DamesEnd = 'pieces' | 'blocked' | 'repetition' | 'kings25' | 'endgame';

export interface DamesMove {
  from: number;
  /** Every square the piece lands on, in order: one for a simple move, one per piece taken otherwise. */
  path: number[];
  /** The squares of the pieces taken, in order. */
  captures: number[];
}

export interface DamesState {
  /** 50 characters, one per dark square. */
  board: string;
  current: DamesPlayer;
  winner: DamesPlayer | null;
  draw: boolean;
  end: DamesEnd | null;
  lastMove: DamesMove | null;
  /** The last move ended with a man crowned. */
  promoted: boolean;
  /** Moves played (by both players). */
  plies: number;
  /** Moves in a row with only a king moved and nothing taken (a draw at 50, 25 each). */
  quiet: number;
  /** Moves played since a short endgame began, -1 outside one. */
  endgame: number;
  /** The positions seen since the last capture or man move, for the threefold repetition. */
  seen: string[];
}

// ---------------------------------------------------------------------------
// Geometry

/** Row (0 at the top) and column of a square. */
export function damesRowCol(sq: number): { row: number; col: number } {
  const row = Math.floor(sq / 5);
  return { row, col: 2 * (sq % 5) + (row % 2 === 0 ? 1 : 0) };
}

/** The square at a row and column, or -1 for a light cell or outside the board. */
export function damesSquareAt(row: number, col: number): number {
  if (row < 0 || row >= DAMES_SIZE || col < 0 || col >= DAMES_SIZE) return -1;
  if ((row + col) % 2 === 0) return -1;
  return row * 5 + Math.floor(col / 2);
}

/** NB[d * 50 + sq]: the next square in direction d (0 up-left, 1 up-right, 2 down-left, 3 down-right). */
const NB: Int8Array = (() => {
  const out = new Int8Array(4 * DAMES_SQUARES);
  const dirs = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (let s = 0; s < DAMES_SQUARES; s++) {
    const { row, col } = damesRowCol(s);
    dirs.forEach(([dr, dc], d) => (out[d * DAMES_SQUARES + s] = damesSquareAt(row + dr, col + dc)));
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Fast board: 0 empty, 1 white man, 2 white king, -1 black man, -2 black king.

type Side = 1 | -1;
const CODE: Record<string, number> = { '.': 0, w: 1, W: 2, b: -1, B: -2 };
const CHAR = ['B', 'b', '.', 'w', 'W'];

function toFast(board: string): Int8Array {
  const b = new Int8Array(DAMES_SQUARES);
  for (let i = 0; i < DAMES_SQUARES; i++) b[i] = CODE[board[i]] ?? 0;
  return b;
}

function toText(b: Int8Array): string {
  let s = '';
  for (let i = 0; i < DAMES_SQUARES; i++) s += CHAR[b[i] + 2];
  return s;
}

const sideOf = (p: DamesPlayer): Side => (p === 0 ? 1 : -1);

/** Squares where a man of this side is crowned. */
const crowns = (side: Side, sq: number) => (side === 1 ? sq < 5 : sq >= 45);

interface FastMove {
  from: number;
  to: number;
  path: number[];
  caps: number[];
}

/**
 * Every legal move of a side. Captures come with the maximum-capture rule applied: only the sequences
 * taking the most pieces are returned.
 */
function generate(b: Int8Array, side: Side): FastMove[] {
  const out: FastMove[] = [];
  let max = 0;
  const taken = new Uint8Array(DAMES_SQUARES);
  const path: number[] = [];
  const caps: number[] = [];
  let from = 0;
  let king = false;

  const dfs = (at: number) => {
    let extended = false;
    for (let d = 0; d < 4; d++) {
      const base = d * DAMES_SQUARES;
      let t = NB[base + at];
      if (king) while (t >= 0 && b[t] === 0) t = NB[base + t];
      if (t < 0 || taken[t] || b[t] * side >= 0) continue;
      let l = NB[base + t];
      if (l < 0 || b[l] !== 0) continue;
      taken[t] = 1;
      caps.push(t);
      do {
        extended = true;
        path.push(l);
        dfs(l);
        path.pop();
        l = king ? NB[base + l] : -1;
      } while (l >= 0 && b[l] === 0);
      caps.pop();
      taken[t] = 0;
    }
    if (!extended && caps.length > 0) {
      if (caps.length > max) {
        max = caps.length;
        out.length = 0;
      }
      if (caps.length === max) out.push({ from, to: at, path: path.slice(), caps: caps.slice() });
    }
  };

  for (let s = 0; s < DAMES_SQUARES; s++) {
    const v = b[s];
    if (v * side <= 0) continue;
    from = s;
    king = v === 2 || v === -2;
    b[s] = 0;
    dfs(s);
    b[s] = v;
  }
  if (max > 0) return out;

  for (let s = 0; s < DAMES_SQUARES; s++) {
    const v = b[s];
    if (v * side <= 0) continue;
    if (v === 2 || v === -2) {
      for (let d = 0; d < 4; d++) {
        let t = NB[d * DAMES_SQUARES + s];
        while (t >= 0 && b[t] === 0) {
          out.push({ from: s, to: t, path: [t], caps: [] });
          t = NB[d * DAMES_SQUARES + t];
        }
      }
    } else {
      const first = side === 1 ? 0 : 2;
      for (let d = first; d < first + 2; d++) {
        const t = NB[d * DAMES_SQUARES + s];
        if (t >= 0 && b[t] === 0) out.push({ from: s, to: t, path: [t], caps: [] });
      }
    }
  }
  return out;
}

/** Plays a move on a fast board; returns what is needed to take it back. */
function make(b: Int8Array, m: FastMove): number[] {
  const v = b[m.from];
  const undo = [v];
  b[m.from] = 0;
  for (const c of m.caps) {
    undo.push(b[c]);
    b[c] = 0;
  }
  const side = v > 0 ? 1 : -1;
  b[m.to] = (v === 1 || v === -1) && crowns(side, m.to) ? 2 * side : v;
  return undo;
}

function unmake(b: Int8Array, m: FastMove, undo: number[]) {
  b[m.to] = 0;
  for (let i = 0; i < m.caps.length; i++) b[m.caps[i]] = undo[i + 1];
  b[m.from] = undo[0];
}

// ---------------------------------------------------------------------------
// Rules

export const DAMES_START = 'b'.repeat(20) + '.'.repeat(10) + 'w'.repeat(20);

export function damesNewGame(board: string = DAMES_START, current: DamesPlayer = 0): DamesState {
  return {
    board,
    current,
    winner: null,
    draw: false,
    end: null,
    lastMove: null,
    promoted: false,
    plies: 0,
    quiet: 0,
    endgame: endgameLimit(toFast(board)) > 0 ? 0 : -1,
    seen: [board + current],
  };
}

export const damesOther = (p: DamesPlayer): DamesPlayer => (p === 0 ? 1 : 0);

export function damesFinished(state: DamesState): boolean {
  return state.winner !== null || state.draw;
}

/** The owner of a piece, or null for an empty square. */
export function damesOwner(piece: string): DamesPlayer | null {
  return piece === 'w' || piece === 'W' ? 0 : piece === 'b' || piece === 'B' ? 1 : null;
}

export const damesIsKing = (piece: string) => piece === 'W' || piece === 'B';

/** Men and kings a player has on the board. */
export function damesCount(board: string, player: DamesPlayer): { men: number; kings: number } {
  const [man, king] = player === 0 ? ['w', 'W'] : ['b', 'B'];
  let men = 0;
  let kings = 0;
  for (const ch of board) {
    if (ch === man) men++;
    else if (ch === king) kings++;
  }
  return { men, kings };
}

const toPublic = (m: FastMove): DamesMove => ({ from: m.from, path: m.path, captures: m.caps });

/** Every move the current player may make (empty once the game is over). */
export function damesLegalMoves(state: DamesState): DamesMove[] {
  if (damesFinished(state)) return [];
  return generate(toFast(state.board), sideOf(state.current)).map(toPublic);
}

/** How many moves a short endgame may last before it is drawn, or 0 when the material is not one. */
function endgameLimit(b: Int8Array): number {
  let white = 0;
  let black = 0;
  let whiteKings = 0;
  let blackKings = 0;
  for (let i = 0; i < DAMES_SQUARES; i++) {
    const v = b[i];
    if (v > 0) {
      white++;
      if (v === 2) whiteKings++;
    } else if (v < 0) {
      black++;
      if (v === -2) blackKings++;
    }
  }
  const check = (lone: number, loneKings: number, strong: number, strongKings: number) =>
    lone === 1 && loneKings === 1 && strong <= 3 && strongKings >= 1 ? (strong === 3 ? 32 : 10) : 0;
  return Math.max(check(white, whiteKings, black, blackKings), check(black, blackKings, white, whiteKings));
}

/** Plays a move of the current player, given by its starting square and the squares it lands on. */
export function damesPlay(state: DamesState, move: { from: number; path: number[] }): DamesState {
  if (damesFinished(state)) throw new Error('La partie est finie');
  const { from, path } = move;
  if (!Number.isInteger(from) || from < 0 || from >= DAMES_SQUARES) throw new Error('Case inconnue');
  if (!Array.isArray(path) || path.length === 0 || path.length > 20) throw new Error('Coup inconnu');
  for (const sq of path)
    if (!Number.isInteger(sq) || sq < 0 || sq >= DAMES_SQUARES) throw new Error('Case inconnue');
  const b = toFast(state.board);
  const side = sideOf(state.current);
  if (b[from] * side <= 0) throw new Error('Ce n’est pas ton pion');
  const moves = generate(b, side);
  const m = moves.find(
    (x) => x.from === from && x.path.length === path.length && x.path.every((s, i) => s === path[i]),
  );
  if (!m) {
    if (moves.length > 0 && moves[0].caps.length > 0)
      throw new Error(
        moves[0].caps.length > 1
          ? `Prise obligatoire : il faut prendre ${moves[0].caps.length} pièces`
          : 'Prise obligatoire',
      );
    throw new Error('Coup impossible');
  }
  const wasMan = b[from] === 1 || b[from] === -1;
  make(b, m);
  const board = toText(b);
  const promoted = wasMan && (b[m.to] === 2 || b[m.to] === -2);
  const next = damesOther(state.current);
  const irreversible = wasMan || m.caps.length > 0;
  const key = board + next;
  const seen = irreversible ? [key] : [...state.seen, key];
  const quiet = irreversible ? 0 : state.quiet + 1;
  const limit = endgameLimit(b);
  const endgame = limit === 0 ? -1 : state.endgame >= 0 && m.caps.length === 0 ? state.endgame + 1 : 0;

  let winner: DamesPlayer | null = null;
  let draw = false;
  let end: DamesEnd | null = null;
  if (generate(b, sideOf(next)).length === 0) {
    winner = state.current;
    end = b.some((v) => v * sideOf(next) > 0) ? 'blocked' : 'pieces';
  } else if (seen.filter((k) => k === key).length >= 3) {
    draw = true;
    end = 'repetition';
  } else if (quiet >= 50) {
    draw = true;
    end = 'kings25';
  } else if (limit > 0 && endgame >= limit) {
    draw = true;
    end = 'endgame';
  }
  return {
    board,
    current: winner !== null || draw ? state.current : next,
    winner,
    draw,
    end,
    lastMove: toPublic(m),
    promoted,
    plies: state.plies + 1,
    quiet,
    endgame,
    seen,
  };
}

// ---------------------------------------------------------------------------
// Robot

const MAN = 100;
const KING = 320;
const WIN = 100_000;

/** Bonus of a man by row, from its own side (index 0 = its home row). */
const ADVANCE = [6, 0, 2, 5, 9, 14, 20, 28, 38, 0];
/** Bonus of a man on the central columns. */
const CENTER = [0, 1, 3, 5, 6, 6, 5, 3, 1, 0];

/** Static value of a position for White. */
function evaluate(b: Int8Array): number {
  let score = 0;
  let white = 0;
  let black = 0;
  for (let s = 0; s < DAMES_SQUARES; s++) {
    const v = b[s];
    if (v === 0) continue;
    const row = Math.floor(s / 5);
    const col = 2 * (s % 5) + (row % 2 === 0 ? 1 : 0);
    if (v === 1) {
      white++;
      score += MAN + ADVANCE[9 - row] + CENTER[col];
    } else if (v === -1) {
      black++;
      score -= MAN + ADVANCE[row] + CENTER[col];
    } else if (v === 2) {
      white++;
      score += KING;
    } else {
      black++;
      score -= KING;
    }
  }
  // Trading pieces when ahead brings the win closer.
  if (score > 150 && black > 0) score += (20 - black) * 4;
  if (score < -150 && white > 0) score -= (20 - white) * 4;
  return score;
}

interface Search {
  b: Int8Array;
  nodes: number;
  budget: number;
  stopped: boolean;
}

/** Negamax with alpha-beta; forced captures are followed past the horizon. */
function negamax(s: Search, side: Side, depth: number, alpha: number, beta: number, ply: number): number {
  s.nodes++;
  if (s.nodes > s.budget) s.stopped = true;
  const moves = generate(s.b, side);
  if (moves.length === 0) return -(WIN - ply);
  const capturing = moves[0].caps.length > 0;
  if (depth <= 0 && (!capturing || depth < -6 || s.stopped)) return side * evaluate(s.b);
  let best = -Infinity;
  for (const m of moves) {
    const undo = make(s.b, m);
    const value = -negamax(s, side === 1 ? -1 : 1, depth - 1, -beta, -alpha, ply + 1);
    unmake(s.b, m, undo);
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta || s.stopped) break;
  }
  return best;
}

/** Score of every move of the current player, searched `depth` moves ahead. */
function rootScores(
  board: string,
  player: DamesPlayer,
  depth: number,
  budget: number,
  order?: FastMove[],
): { moves: FastMove[]; scores: number[]; complete: boolean } {
  const b = toFast(board);
  const side = sideOf(player);
  const moves = order ?? generate(b, side);
  const s: Search = { b, nodes: 0, budget, stopped: false };
  const scores: number[] = [];
  let alpha = -Infinity;
  for (const m of moves) {
    const undo = make(b, m);
    // Every root move gets an exact score up to a small window, so ties can be told apart.
    const value = -negamax(s, side === 1 ? -1 : 1, depth - 1, -Infinity, -(alpha - 1), 1);
    unmake(b, m, undo);
    scores.push(value);
    if (value > alpha) alpha = value;
  }
  return { moves, scores, complete: !s.stopped };
}

/**
 * The robot's move. Facile plays any legal move; Moyen takes the move that leaves it best off once
 * you have answered; Difficile searches deeper with alpha-beta, within a fixed budget so a phone
 * answers at once.
 */
export function damesBotMove(state: DamesState, level: DamesLevel, rng: Rng = secureRng): DamesMove {
  const b = toFast(state.board);
  const moves = generate(b, sideOf(state.current));
  if (moves.length === 0 || damesFinished(state)) throw new Error('Aucun coup possible');
  if (moves.length === 1 || level === 'facile') return toPublic(moves[rng(moves.length)]);

  if (level === 'moyen') {
    const { scores } = rootScores(state.board, state.current, 2, 50_000, moves);
    // A little noise so it does not always play the same game.
    const noisy = scores.map((v) => v + rng(12));
    const best = Math.max(...noisy);
    return toPublic(moves[noisy.indexOf(best)]);
  }

  // Iterative deepening: each finished depth sorts the moves for the next one.
  let order = moves;
  let bestScores: number[] | null = null;
  for (let depth = 2; depth <= 10; depth++) {
    const r = rootScores(state.board, state.current, depth, 25_000, order);
    if (!r.complete && bestScores) break;
    const ranked = r.moves.map((m, i) => ({ m, v: r.scores[i] })).sort((x, y) => y.v - x.v);
    order = ranked.map((x) => x.m);
    bestScores = ranked.map((x) => x.v);
    if (!r.complete || Math.abs(bestScores[0]) > WIN / 2) break;
  }
  const top = bestScores![0];
  const ties = order.filter((_, i) => bestScores![i] === top);
  return toPublic(ties[rng(ties.length)]);
}
