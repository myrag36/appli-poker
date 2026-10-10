import { type Rng, secureRng } from './cards.ts';

/**
 * Échecs (chess) with every rule: castling, en passant, promotion to the piece of one's choice,
 * check, checkmate, stalemate, threefold repetition, the 50-move rule and insufficient material.
 * The public state is plain data (a 64-character board), pure and immutable like the other games;
 * a mutable board with make/unmake is used inside for move generation and for the robot's search.
 *
 * Squares are named 'a1'…'h8'. Player 0 plays white and starts, player 1 plays black.
 * Moves are written in standard algebraic notation with English letters (Nf3, exd5, O-O, e8=Q+);
 * screens may draw the letters as figurines.
 */

export type ChessPlayer = 0 | 1;
export type ChessLevel = 'facile' | 'moyen' | 'difficile';
export type ChessPromo = 'q' | 'r' | 'b' | 'n';

export const CHESS_LEVEL_LABELS: Record<ChessLevel, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

export const CHESS_PROMOS: ChessPromo[] = ['q', 'r', 'b', 'n'];

export interface ChessMove {
  from: string;
  to: string;
  /** Only for a pawn reaching the last rank. */
  promo?: ChessPromo;
}

/** How a game ended: checkmate, stalemate, threefold repetition, 50 moves, too little material, resignation. */
export type ChessEnd = 'mat' | 'pat' | 'repetition' | 'cinquante' | 'materiel' | 'abandon';

export interface ChessResult {
  /** null for a draw. */
  winner: ChessPlayer | null;
  reason: ChessEnd;
}

export interface ChessState {
  /**
   * 64 characters from a1, b1… to h8: '.' empty, 'PNBRQK' white pieces, 'pnbrqk' black pieces.
   */
  board: string;
  /** Who plays now. */
  turn: ChessPlayer;
  /** Castling rights still kept, as in FEN ('KQkq', '-' when none). */
  castling: string;
  /** Square a pawn just skipped over with its double step, or null. */
  ep: string | null;
  /** Half-moves since the last capture or pawn move (the 50-move rule ends the game at 100). */
  halfmove: number;
  /** Starts at 1 and goes up after each black move. */
  fullmove: number;
  /** Every position since the last capture or pawn move, the current one last (threefold repetition). */
  keys: string[];
  /** Every move of the game in algebraic notation. */
  moves: string[];
  lastMove: { from: string; to: string } | null;
  /** Pieces taken so far, in order, as board letters ('p' a black pawn taken by white). */
  captured: string;
  /** The player to move is in check. */
  check: boolean;
  result: ChessResult | null;
}

export const CHESS_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ---------------------------------------------------------------------------
// Board geometry

const FILES = 'abcdefgh';
const LETTERS = 'PNBRQK';
const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;

export function chessSquareName(sq: number): string {
  return FILES[sq & 7] + ((sq >> 3) + 1);
}

/** Index 0…63 of a square name, or -1 when it is not one. */
export function chessSquareIndex(name: unknown): number {
  if (typeof name !== 'string' || name.length !== 2) return -1;
  const f = FILES.indexOf(name[0]);
  const r = name.charCodeAt(1) - 49;
  if (f < 0 || r < 0 || r > 7) return -1;
  return r * 8 + f;
}

function pieceOf(ch: string): number {
  const i = LETTERS.indexOf(ch.toUpperCase());
  if (i < 0) return 0;
  return ch === ch.toUpperCase() ? i + 1 : -(i + 1);
}

function charOf(p: number): string {
  if (p === 0) return '.';
  return p > 0 ? LETTERS[p - 1] : LETTERS[-p - 1].toLowerCase();
}

const inside = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

function jumps(deltas: [number, number][]): number[][] {
  return Array.from({ length: 64 }, (_, sq) => {
    const out: number[] = [];
    for (const [df, dr] of deltas) {
      const f = (sq & 7) + df;
      const r = (sq >> 3) + dr;
      if (inside(f, r)) out.push(r * 8 + f);
    }
    return out;
  });
}

const KNIGHT_TO = jumps([
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]);
const KING_TO = jumps([
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
]);
/** Rays of squares from every square: the first 4 directions are a rook's, the last 4 a bishop's. */
const RAYS: number[][][] = Array.from({ length: 64 }, (_, sq) =>
  (
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as [number, number][]
  ).map(([df, dr]) => {
    const out: number[] = [];
    let f = (sq & 7) + df;
    let r = (sq >> 3) + dr;
    while (inside(f, r)) {
      out.push(r * 8 + f);
      f += df;
      r += dr;
    }
    return out;
  }),
);

/** Castling rights kept when a move leaves or lands on a square (rooks and kings home squares). */
const CASTLE_MASK = Array.from({ length: 64 }, (_, sq) => {
  if (sq === 0) return 15 & ~2;
  if (sq === 7) return 15 & ~1;
  if (sq === 4) return 15 & ~3;
  if (sq === 56) return 15 & ~8;
  if (sq === 63) return 15 & ~4;
  if (sq === 60) return 15 & ~12;
  return 15;
});

// Moves are numbers: from | to << 6 | promoted piece type << 12 | flags << 16.
const EP = 1;
const CASTLE = 2;
const DOUBLE = 4;
const mFrom = (m: number) => m & 63;
const mTo = (m: number) => (m >> 6) & 63;
const mPromo = (m: number) => (m >> 12) & 7;
const mFlags = (m: number) => m >> 16;
const encode = (from: number, to: number, promo = 0, flags = 0) =>
  from | (to << 6) | (promo << 12) | (flags << 16);

// ---------------------------------------------------------------------------
// The mutable board

class Position {
  b = new Int8Array(64);
  /** 1 white to move, -1 black. */
  side = 1;
  /** 1 white O-O, 2 white O-O-O, 4 black O-O, 8 black O-O-O. */
  castle = 0;
  ep = -1;
  half = 0;
  kings = [4, 60];
  private undo: number[] = [];

  clone(): Position {
    const p = new Position();
    p.b.set(this.b);
    p.side = this.side;
    p.castle = this.castle;
    p.ep = this.ep;
    p.half = this.half;
    p.kings = [...this.kings];
    return p;
  }

  king(side: number) {
    return this.kings[side === 1 ? 0 : 1];
  }

  /** Is the square attacked by a piece of `by` (1 white, -1 black)? */
  attacked(sq: number, by: number): boolean {
    const b = this.b;
    const f = sq & 7;
    if (by === 1) {
      if (sq >= 8) {
        if (f > 0 && b[sq - 9] === PAWN) return true;
        if (f < 7 && b[sq - 7] === PAWN) return true;
      }
    } else if (sq < 56) {
      if (f > 0 && b[sq + 7] === -PAWN) return true;
      if (f < 7 && b[sq + 9] === -PAWN) return true;
    }
    const knight = KNIGHT * by;
    for (const t of KNIGHT_TO[sq]) if (b[t] === knight) return true;
    const king = KING * by;
    for (const t of KING_TO[sq]) if (b[t] === king) return true;
    const rays = RAYS[sq];
    const rook = ROOK * by;
    const bishop = BISHOP * by;
    const queen = QUEEN * by;
    for (let d = 0; d < 8; d++) {
      const slider = d < 4 ? rook : bishop;
      for (const t of rays[d]) {
        const p = b[t];
        if (p === 0) continue;
        if (p === slider || p === queen) return true;
        break;
      }
    }
    return false;
  }

  inCheck(): boolean {
    return this.attacked(this.king(this.side), -this.side);
  }

  /** Moves that follow the pieces' paths, without checking that the own king stays safe. */
  pseudo(out: number[], capturesOnly = false): number[] {
    const b = this.b;
    const side = this.side;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq] * side;
      if (p <= 0) continue;
      if (p === PAWN) {
        const dir = 8 * side;
        const rank = sq >> 3;
        const lastStep = side === 1 ? rank === 6 : rank === 1;
        const f = sq & 7;
        const one = sq + dir;
        if (b[one] === 0) {
          if (lastStep) {
            out.push(encode(sq, one, QUEEN));
            if (!capturesOnly) {
              out.push(encode(sq, one, ROOK), encode(sq, one, BISHOP), encode(sq, one, KNIGHT));
            }
          } else if (!capturesOnly) {
            out.push(encode(sq, one));
            const home = side === 1 ? rank === 1 : rank === 6;
            if (home && b[one + dir] === 0) out.push(encode(sq, one + dir, 0, DOUBLE));
          }
        }
        for (const df of [-1, 1]) {
          if (f + df < 0 || f + df > 7) continue;
          const t = one + df;
          if (b[t] * side < 0) {
            if (lastStep) for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(encode(sq, t, promo));
            else out.push(encode(sq, t));
          } else if (t === this.ep) out.push(encode(sq, t, 0, EP));
        }
        continue;
      }
      if (p === KNIGHT || p === KING) {
        for (const t of (p === KNIGHT ? KNIGHT_TO : KING_TO)[sq]) {
          const q = b[t] * side;
          if (q < 0 || (q === 0 && !capturesOnly)) out.push(encode(sq, t));
        }
        if (p === KING && !capturesOnly) this.castles(sq, out);
        continue;
      }
      const first = p === BISHOP ? 4 : 0;
      const last = p === ROOK ? 4 : 8;
      for (let d = first; d < last; d++) {
        for (const t of RAYS[sq][d]) {
          const q = b[t] * side;
          if (q > 0) break;
          if (q < 0) {
            out.push(encode(sq, t));
            break;
          }
          if (!capturesOnly) out.push(encode(sq, t));
        }
      }
    }
    return out;
  }

  private castles(sq: number, out: number[]) {
    const b = this.b;
    const side = this.side;
    const home = side === 1 ? 4 : 60;
    if (sq !== home) return;
    const enemy = -side;
    const short = side === 1 ? 1 : 4;
    const long = side === 1 ? 2 : 8;
    if (!(this.castle & (short | long)) || this.attacked(home, enemy)) return;
    if (
      this.castle & short &&
      b[home + 3] === ROOK * side &&
      b[home + 1] === 0 &&
      b[home + 2] === 0 &&
      !this.attacked(home + 1, enemy) &&
      !this.attacked(home + 2, enemy)
    )
      out.push(encode(home, home + 2, 0, CASTLE));
    if (
      this.castle & long &&
      b[home - 4] === ROOK * side &&
      b[home - 1] === 0 &&
      b[home - 2] === 0 &&
      b[home - 3] === 0 &&
      !this.attacked(home - 1, enemy) &&
      !this.attacked(home - 2, enemy)
    )
      out.push(encode(home, home - 2, 0, CASTLE));
  }

  /** Plays a move; returns false (and takes it back) when it leaves the own king in check. */
  make(m: number): boolean {
    const b = this.b;
    const from = mFrom(m);
    const to = mTo(m);
    const flags = mFlags(m);
    const side = this.side;
    const piece = b[from];
    let captured = b[to];
    this.undo.push(m, captured, this.castle, this.ep, this.half);
    if (flags & EP) {
      const at = to - 8 * side;
      captured = b[at];
      b[at] = 0;
      this.undo[this.undo.length - 4] = captured;
    }
    const promo = mPromo(m);
    b[to] = promo ? promo * side : piece;
    b[from] = 0;
    if (flags & CASTLE) {
      const rookFrom = to > from ? to + 1 : to - 2;
      const rookTo = to > from ? to - 1 : to + 1;
      b[rookTo] = b[rookFrom];
      b[rookFrom] = 0;
    }
    if (piece * side === KING) this.kings[side === 1 ? 0 : 1] = to;
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.ep = flags & DOUBLE ? from + 8 * side : -1;
    this.half = piece * side === PAWN || captured !== 0 ? 0 : this.half + 1;
    this.side = -side;
    if (this.attacked(this.king(side), -side)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake() {
    const u = this.undo;
    const half = u.pop()!;
    const ep = u.pop()!;
    const castle = u.pop()!;
    const captured = u.pop()!;
    const m = u.pop()!;
    const b = this.b;
    const from = mFrom(m);
    const to = mTo(m);
    const flags = mFlags(m);
    const side = -this.side;
    this.side = side;
    this.castle = castle;
    this.ep = ep;
    this.half = half;
    const piece = mPromo(m) ? PAWN * side : b[to];
    b[from] = piece;
    if (flags & EP) {
      b[to] = 0;
      b[to - 8 * side] = captured;
    } else b[to] = captured;
    if (flags & CASTLE) {
      const rookFrom = to > from ? to + 1 : to - 2;
      const rookTo = to > from ? to - 1 : to + 1;
      b[rookFrom] = b[rookTo];
      b[rookTo] = 0;
    }
    if (piece * side === KING) this.kings[side === 1 ? 0 : 1] = from;
  }

  legal(): number[] {
    const out: number[] = [];
    for (const m of this.pseudo([])) {
      if (this.make(m)) {
        out.push(m);
        this.unmake();
      }
    }
    return out;
  }

  hasLegal(): boolean {
    for (const m of this.pseudo([])) {
      if (this.make(m)) {
        this.unmake();
        return true;
      }
    }
    return false;
  }

  /** The en passant square, only when a pawn could really take there (as FIDE counts repetitions). */
  usefulEp(): number {
    if (this.ep < 0) return -1;
    const pawn = PAWN * this.side;
    const from = this.ep - 8 * this.side;
    const f = this.ep & 7;
    const b = this.b;
    if ((f > 0 && b[from - 1] === pawn) || (f < 7 && b[from + 1] === pawn)) {
      for (const m of this.pseudo([], true))
        if (mFlags(m) & EP) {
          if (this.make(m)) {
            this.unmake();
            return this.ep;
          }
        }
    }
    return -1;
  }

  boardString(): string {
    let s = '';
    for (let i = 0; i < 64; i++) s += charOf(this.b[i]);
    return s;
  }

  castleString(): string {
    const c = this.castle;
    const s = (c & 1 ? 'K' : '') + (c & 2 ? 'Q' : '') + (c & 4 ? 'k' : '') + (c & 8 ? 'q' : '');
    return s || '-';
  }

  /** What makes two positions the same for the repetition rule. */
  key(): string {
    const ep = this.usefulEp();
    return `${this.boardString()} ${this.side === 1 ? 'w' : 'b'} ${this.castleString()} ${ep < 0 ? '-' : chessSquareName(ep)}`;
  }

  insufficient(): boolean {
    const minors: { piece: number; sq: number }[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = Math.abs(this.b[sq]);
      if (p === 0 || p === KING) continue;
      if (p === PAWN || p === ROOK || p === QUEEN) return false;
      minors.push({ piece: this.b[sq], sq });
      if (minors.length > 2) return false;
    }
    if (minors.length < 2) return true;
    // Two bishops of opposite sides on squares of the same color cannot mate either.
    const [a, c] = minors;
    const color = (sq: number) => ((sq & 7) + (sq >> 3)) & 1;
    return (
      Math.abs(a.piece) === BISHOP &&
      Math.abs(c.piece) === BISHOP &&
      Math.sign(a.piece) !== Math.sign(c.piece) &&
      color(a.sq) === color(c.sq)
    );
  }
}

function positionFromState(s: ChessState): Position {
  const p = new Position();
  for (let i = 0; i < 64; i++) {
    const v = pieceOf(s.board[i]);
    p.b[i] = v;
    if (v === KING) p.kings[0] = i;
    if (v === -KING) p.kings[1] = i;
  }
  p.side = s.turn === 0 ? 1 : -1;
  p.castle =
    (s.castling.includes('K') ? 1 : 0) |
    (s.castling.includes('Q') ? 2 : 0) |
    (s.castling.includes('k') ? 4 : 0) |
    (s.castling.includes('q') ? 8 : 0);
  p.ep = s.ep ? chessSquareIndex(s.ep) : -1;
  p.half = s.halfmove;
  return p;
}

// ---------------------------------------------------------------------------
// Public rules

function stateFrom(p: Position, base: Partial<ChessState>): ChessState {
  const key = p.key();
  const keys = base.keys ?? [key];
  const check = p.inCheck();
  let result: ChessResult | null = null;
  const mover: ChessPlayer = p.side === 1 ? 1 : 0;
  if (!p.hasLegal()) result = check ? { winner: mover, reason: 'mat' } : { winner: null, reason: 'pat' };
  else if (p.insufficient()) result = { winner: null, reason: 'materiel' };
  else if (keys.filter((k) => k === key).length >= 3) result = { winner: null, reason: 'repetition' };
  else if (p.half >= 100) result = { winner: null, reason: 'cinquante' };
  return {
    board: p.boardString(),
    turn: p.side === 1 ? 0 : 1,
    castling: p.castleString(),
    ep: p.ep < 0 ? null : chessSquareName(p.ep),
    halfmove: p.half,
    fullmove: base.fullmove ?? 1,
    keys,
    moves: base.moves ?? [],
    lastMove: base.lastMove ?? null,
    captured: base.captured ?? '',
    check,
    result,
  };
}

export function chessNewGame(): ChessState {
  return chessFromFen(CHESS_START_FEN);
}

/** A game starting from a FEN position (for tests and puzzles). */
export function chessFromFen(fen: string): ChessState {
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error('Position FEN invalide');
  const p = new Position();
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        const v = pieceOf(ch);
        if (!v || file > 7) throw new Error('Position FEN invalide');
        p.b[rank * 8 + file] = v;
        if (v === KING) p.kings[0] = rank * 8 + file;
        if (v === -KING) p.kings[1] = rank * 8 + file;
        file++;
      }
    }
    if (file !== 8) throw new Error('Position FEN invalide');
  });
  p.side = turn === 'b' ? -1 : 1;
  p.castle =
    (castling.includes('K') ? 1 : 0) |
    (castling.includes('Q') ? 2 : 0) |
    (castling.includes('k') ? 4 : 0) |
    (castling.includes('q') ? 8 : 0);
  p.ep = ep === '-' ? -1 : chessSquareIndex(ep);
  p.half = Number(half) || 0;
  return stateFrom(p, { fullmove: Number(full) || 1 });
}

export function chessToFen(s: ChessState): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const ch = s.board[rank * 8 + f];
      if (ch === '.') empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += ch;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} ${s.turn === 0 ? 'w' : 'b'} ${s.castling} ${s.ep ?? '-'} ${s.halfmove} ${s.fullmove}`;
}

/** The piece on a square ('.' when empty), as a board letter. */
export function chessPieceAt(s: ChessState, square: string): string {
  const i = chessSquareIndex(square);
  return i < 0 ? '.' : s.board[i];
}

export const chessColorOf = (piece: string): ChessPlayer | null =>
  piece === '.' ? null : piece === piece.toUpperCase() ? 0 : 1;

function toMove(m: number): ChessMove {
  const promo = mPromo(m);
  const out: ChessMove = { from: chessSquareName(mFrom(m)), to: chessSquareName(mTo(m)) };
  if (promo) out.promo = 'xpnbrqk'[promo] as ChessPromo;
  return out;
}

/** Every legal move of the player to move (four for each promotion), none once the game is over. */
export function chessLegalMoves(s: ChessState): ChessMove[] {
  if (s.result) return [];
  return positionFromState(s).legal().map(toMove);
}

/** Square of a player's king. */
export function chessKingSquare(s: ChessState, player: ChessPlayer): string {
  return chessSquareName(s.board.indexOf(player === 0 ? 'K' : 'k'));
}

/** Algebraic notation of a legal move, before it is played. */
function san(p: Position, m: number, legal: number[]): string {
  const from = mFrom(m);
  const to = mTo(m);
  const piece = Math.abs(p.b[from]);
  let out: string;
  if (mFlags(m) & CASTLE) out = to > from ? 'O-O' : 'O-O-O';
  else {
    const capture = p.b[to] !== 0 || (mFlags(m) & EP) !== 0;
    if (piece === PAWN) {
      out = capture ? `${FILES[from & 7]}x` : '';
      out += chessSquareName(to);
      const promo = mPromo(m);
      if (promo) out += `=${LETTERS[promo - 1]}`;
    } else {
      out = LETTERS[piece - 1];
      const others = legal.filter(
        (o) => mTo(o) === to && mFrom(o) !== from && Math.abs(p.b[mFrom(o)]) === piece,
      );
      if (others.length > 0) {
        const sameFile = others.some((o) => (mFrom(o) & 7) === (from & 7));
        const sameRank = others.some((o) => mFrom(o) >> 3 === from >> 3);
        if (!sameFile) out += FILES[from & 7];
        else if (!sameRank) out += String((from >> 3) + 1);
        else out += chessSquareName(from);
      }
      if (capture) out += 'x';
      out += chessSquareName(to);
    }
  }
  p.make(m);
  if (p.inCheck()) out += p.hasLegal() ? '+' : '#';
  p.unmake();
  return out;
}

/** Plays a move for the player to move; throws a French message when it is not allowed. */
export function chessPlay(s: ChessState, move: ChessMove): ChessState {
  if (s.result) throw new Error('La partie est finie');
  const from = chessSquareIndex(move?.from);
  const to = chessSquareIndex(move?.to);
  if (from < 0 || to < 0) throw new Error('Case inconnue');
  const promo = move.promo;
  if (promo !== undefined && !CHESS_PROMOS.includes(promo)) throw new Error('Promotion inconnue');
  const p = positionFromState(s);
  const legal = p.legal();
  const candidates = legal.filter((m) => mFrom(m) === from && mTo(m) === to);
  if (candidates.length === 0) throw new Error('Ce coup n’est pas permis');
  let m = candidates[0];
  if (candidates.length > 1) {
    if (!promo) throw new Error('Choisis la pièce de la promotion');
    m = candidates.find((c) => 'xpnbrqk'[mPromo(c)] === promo)!;
  } else if (promo) throw new Error('Ce coup n’est pas une promotion');
  const notation = san(p, m, legal);
  const captured = mFlags(m) & EP ? (p.side === 1 ? 'p' : 'P') : p.b[to] !== 0 ? charOf(p.b[to]) : '';
  const moverWasBlack = p.side === -1;
  p.make(m);
  const key = p.key();
  return stateFrom(p, {
    keys: p.half === 0 ? [key] : [...s.keys, key],
    fullmove: s.fullmove + (moverWasBlack ? 1 : 0),
    moves: [...s.moves, notation],
    lastMove: { from: chessSquareName(from), to: chessSquareName(to) },
    captured: s.captured + captured,
  });
}

/** The player gives up: the other one wins. */
export function chessResign(s: ChessState, player: ChessPlayer): ChessState {
  if (s.result) throw new Error('La partie est finie');
  return { ...s, result: { winner: player === 0 ? 1 : 0, reason: 'abandon' } };
}

/** Number of move sequences of a given depth: the standard check that move generation is right. */
export function chessPerft(fen: string, depth: number): number {
  const p = positionFromState(chessFromFen(fen));
  const walk = (d: number): number => {
    const moves = p.pseudo([]);
    let n = 0;
    for (const m of moves) {
      if (!p.make(m)) continue;
      n += d <= 1 ? 1 : walk(d - 1);
      p.unmake();
    }
    return n;
  };
  return depth === 0 ? 1 : walk(depth);
}

// ---------------------------------------------------------------------------
// Robot

const VALUE = [0, 100, 320, 330, 500, 900, 0];

// Piece-square tables (simplified evaluation function), from white's side, a8 first.
// prettier-ignore
const PST: number[][] = [
  [],
  [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
];
// prettier-ignore
const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];
const PHASE = [0, 0, 1, 1, 2, 4, 0];

/** Value of the position for the side to move, in hundredths of a pawn. */
function evaluate(p: Position): number {
  const b = p.b;
  let score = 0;
  let phase = 0;
  let kingMid = 0;
  let kingEnd = 0;
  const bishops = [0, 0];
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq];
    if (v === 0) continue;
    const t = v > 0 ? v : -v;
    const idx = v > 0 ? (7 - (sq >> 3)) * 8 + (sq & 7) : sq;
    const sign = v > 0 ? 1 : -1;
    phase += PHASE[t];
    if (t === KING) {
      kingMid += sign * PST[KING][idx];
      kingEnd += sign * KING_END[idx];
      continue;
    }
    if (t === BISHOP) bishops[v > 0 ? 0 : 1]++;
    score += sign * (VALUE[t] + PST[t][idx]);
  }
  const ph = Math.min(phase, 24);
  score += (kingMid * ph + kingEnd * (24 - ph)) / 24;
  if (bishops[0] >= 2) score += 30;
  if (bishops[1] >= 2) score -= 30;
  return Math.round(score) * p.side;
}

const MATE = 100_000;
const INF = 1_000_000;

class Abort extends Error {}

class Search {
  nodes = 0;
  killers: number[][] = Array.from({ length: 64 }, () => [0, 0]);
  p: Position;
  private deadline: number;
  constructor(p: Position, deadline: number) {
    this.p = p;
    this.deadline = deadline;
  }

  private tick() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) throw new Abort();
  }

  /** Ordering score of a move: captures by MVV-LVA, promotions, then killer moves. */
  private order(moves: number[], ply: number, first = 0): number[] {
    const b = this.p.b;
    const k = this.killers[ply] ?? [0, 0];
    const scored = moves.map((m) => {
      let s = 0;
      const victim = Math.abs(b[mTo(m)]);
      if (victim) s = 10_000 + VALUE[victim] * 10 - VALUE[Math.abs(b[mFrom(m)])] / 10;
      else if (mFlags(m) & EP) s = 10_000 + 1000;
      if (mPromo(m)) s += 9_000 + VALUE[mPromo(m)];
      if (m === k[0] || m === k[1]) s += 5_000;
      if (m === first) s += 100_000;
      return { m, s };
    });
    scored.sort((a, c) => c.s - a.s);
    return scored.map((x) => x.m);
  }

  quiesce(alpha: number, beta: number, ply: number): number {
    this.tick();
    const stand = evaluate(this.p);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 40) return stand;
    for (const m of this.order(this.p.pseudo([], true), 63)) {
      if (!this.p.make(m)) continue;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      this.p.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.tick();
    const p = this.p;
    if (p.half >= 100) return 0;
    const check = p.inCheck();
    if (check && ply < 12) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);
    let best = -INF;
    let any = false;
    for (const m of this.order(p.pseudo([]), ply)) {
      if (!p.make(m)) continue;
      any = true;
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      p.unmake();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!p.b[mTo(m)] && !mPromo(m)) {
          const k = this.killers[ply];
          if (k && k[0] !== m) {
            k[1] = k[0];
            k[0] = m;
          }
        }
        break;
      }
    }
    if (!any) return check ? -MATE + ply : 0;
    return best;
  }
}

/**
 * Value of each root move for the player to move, searched `depth` half-moves deep (plus
 * captures). A move repeating a position for the third time is worth a draw. Full window: every
 * score is exact, which lets the lower levels pick among moves of close value.
 */
function rootScores(p: Position, moves: number[], depth: number, keys: string[], search: Search) {
  return moves.map((m) => {
    p.make(m);
    let score: number;
    const key = p.key();
    if (keys.filter((k) => k === key).length >= 2) score = 0;
    else score = -search.negamax(depth - 1, -INF, INF, 1);
    p.unmake();
    return { m, score };
  });
}

/**
 * The robot's move. Facile plays loosely, often an ordinary move, and misses things; Moyen looks
 * two half-moves ahead plus every exchange of pieces; Difficile searches 3 to 4 half-moves with
 * alpha-beta and piece-square tables, within `timeMs` (about 0.7 s, fast enough on a phone).
 */
export function chessBotMove(
  s: ChessState,
  level: ChessLevel,
  rng: Rng = secureRng,
  timeMs = 700,
): ChessMove {
  if (s.result) throw new Error('La partie est finie');
  const p = positionFromState(s);
  const legal = p.legal();
  if (legal.length === 0) throw new Error('Aucun coup possible');
  // Shuffled first, so equal moves are not always played in the same order.
  for (let i = legal.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [legal[i], legal[j]] = [legal[j], legal[i]];
  }
  if (legal.length === 1) return toMove(legal[0]);

  if (level !== 'difficile') {
    const search = new Search(p, Infinity);
    if (level === 'facile' && rng(10) < 3) return toMove(legal[rng(legal.length)]);
    const scores = rootScores(p, legal, level === 'facile' ? 1 : 2, s.keys, search);
    // Facile misjudges by up to 1.5 pawns, Moyen picks among moves within 0.2 pawn of the best.
    const noise = level === 'facile' ? 150 : 0;
    const noisy = scores.map((x) => ({ m: x.m, score: x.score + (noise ? rng(noise * 2) - noise : 0) }));
    const best = Math.max(...noisy.map((x) => x.score));
    const margin = level === 'moyen' && Math.abs(best) < MATE / 2 ? 20 : 0;
    const good = noisy.filter((x) => x.score >= best - margin);
    return toMove(good[rng(good.length)].m);
  }

  // Difficile: iterative deepening, keeping the best move of the deepest finished search.
  const search = new Search(p, Date.now() + timeMs);
  let bestMove = legal[0];
  let order = legal;
  for (let depth = 1; depth <= 4; depth++) {
    try {
      let alpha = -INF;
      let iterationBest = order[0];
      const scored: { m: number; score: number }[] = [];
      for (const m of order) {
        p.make(m);
        const key = p.key();
        let score: number;
        if (s.keys.filter((k) => k === key).length >= 2) score = 0;
        else score = -search.negamax(depth - 1, -INF, -alpha, 1);
        p.unmake();
        scored.push({ m, score });
        if (score > alpha) {
          alpha = score;
          iterationBest = m;
        }
      }
      bestMove = iterationBest;
      // The next search starts with the best moves of this one: better pruning.
      order = scored.sort((a, c) => c.score - a.score).map((x) => x.m);
      if (alpha > MATE / 2) break;
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
      // Unfinished search: keep the previous depth's move, unless this one found better already.
      break;
    }
  }
  return toMove(bestMove);
}
