import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type ChessLevel,
  type ChessState,
  CHESS_START_FEN,
  chessBotMove,
  chessFromFen,
  chessKingSquare,
  chessLegalMoves,
  chessNewGame,
  chessPerft,
  chessPlay,
  chessResign,
  chessToFen,
} from '../src/echecs.ts';

const seeded = (seed: number) => (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return Math.floor((seed / 2147483648) * n);
};

/** Plays moves written as 'e2e4' or 'e7e8q'. */
function play(s: ChessState, ...moves: string[]): ChessState {
  for (const m of moves) {
    const promo = m[4] as 'q' | 'r' | 'b' | 'n' | undefined;
    s = chessPlay(s, { from: m.slice(0, 2), to: m.slice(2, 4), ...(promo ? { promo } : {}) });
  }
  return s;
}

test('perft: the number of move sequences from the start position', () => {
  assert.equal(chessPerft(CHESS_START_FEN, 1), 20);
  assert.equal(chessPerft(CHESS_START_FEN, 2), 400);
  assert.equal(chessPerft(CHESS_START_FEN, 3), 8902);
  assert.equal(chessPerft(CHESS_START_FEN, 4), 197281);
});

test('perft: well-known positions full of castling, en passant and promotions', () => {
  // "Kiwipete"
  const kiwi = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
  assert.equal(chessPerft(kiwi, 1), 48);
  assert.equal(chessPerft(kiwi, 2), 2039);
  assert.equal(chessPerft(kiwi, 3), 97862);
  const endgame = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
  assert.equal(chessPerft(endgame, 4), 43238);
  const promos = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';
  assert.equal(chessPerft(promos, 3), 9467);
  const tricky = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';
  assert.equal(chessPerft(tricky, 3), 62379);
});

test('a new game: white to move, 20 moves, FEN round trip', () => {
  const s = chessNewGame();
  assert.equal(s.turn, 0);
  assert.equal(chessLegalMoves(s).length, 20);
  assert.equal(chessToFen(s), CHESS_START_FEN);
  assert.equal(s.result, null);
  assert.equal(chessKingSquare(s, 0), 'e1');
  assert.equal(chessKingSquare(s, 1), 'e8');
});

test('moves are checked and written in algebraic notation', () => {
  const s = chessNewGame();
  assert.throws(() => play(s, 'e2e5'), /pas permis/);
  assert.throws(() => play(s, 'e7e5'), /pas permis/);
  assert.throws(() => chessPlay(s, { from: 'z9', to: 'e4' }), /Case inconnue/);
  assert.throws(() => chessPlay(s, { from: 'e2', to: 'e4', promo: 'q' }), /pas une promotion/);
  assert.throws(() => chessPlay(s, { from: 'e2', to: 'e4', promo: 'k' as never }), /Promotion inconnue/);
  const after = play(s, 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1');
  assert.deepEqual(after.moves, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O']);
  assert.equal(after.board[5], 'R');
  assert.equal(after.board[6], 'K');
  assert.equal(after.castling, 'kq');
  assert.equal(after.fullmove, 4);
  assert.deepEqual(after.lastMove, { from: 'e1', to: 'g1' });
  // The state given is never changed.
  assert.equal(chessToFen(s), CHESS_START_FEN);
});

test('castling is refused through an attacked square or out of check', () => {
  // The f1 square is attacked by the bishop on c4: no O-O, but O-O-O is fine.
  const s = chessFromFen('r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1');
  const king = chessLegalMoves(s).filter((m) => m.from === 'e1');
  assert.ok(!king.some((m) => m.to === 'g1'));
  assert.ok(king.some((m) => m.to === 'c1'));
  // In check: no castling at all.
  const check = chessFromFen('r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1');
  assert.ok(check.check);
  assert.ok(!chessLegalMoves(check).some((m) => m.from === 'e1' && (m.to === 'g1' || m.to === 'c1')));
  // A rook taken on its square loses that castling right.
  const taken = play(chessFromFen('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1'), 'g2h1');
  assert.equal(taken.castling, 'Qkq');
});

test('en passant, right after the double step only', () => {
  let s = play(chessNewGame(), 'e2e4', 'a7a6', 'e4e5', 'd7d5');
  assert.equal(s.ep, 'd6');
  s = play(s, 'e5d6');
  assert.equal(s.moves.at(-1), 'exd6');
  assert.equal(s.board[3 * 8 + 4], '.');
  assert.equal(s.board[4 * 8 + 3], '.', 'the pawn taken en passant is removed');
  assert.equal(s.captured, 'p');
  // Missed chance: gone after another move.
  const later = play(chessNewGame(), 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'a2a3', 'a6a5');
  assert.throws(() => play(later, 'e5d6'), /pas permis/);
});

test('promotion: the piece is chosen, underpromotion included', () => {
  const s = chessFromFen('7k/P7/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(chessLegalMoves(s).filter((m) => m.from === 'a7').length, 4);
  assert.throws(() => chessPlay(s, { from: 'a7', to: 'a8' }), /promotion/);
  const queen = play(s, 'a7a8q');
  assert.equal(queen.board[56], 'Q');
  assert.equal(queen.moves[0], 'a8=Q+');
  const knight = play(s, 'a7a8n');
  assert.equal(knight.board[56], 'N');
  assert.equal(knight.moves[0], 'a8=N');
});

test('checkmate and stalemate end the game', () => {
  const mate = play(chessNewGame(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  assert.equal(mate.moves.at(-1), 'Qh4#');
  assert.deepEqual(mate.result, { winner: 1, reason: 'mat' });
  assert.equal(mate.check, true);
  assert.deepEqual(chessLegalMoves(mate), []);
  assert.throws(() => play(mate, 'a2a3'), /finie/);
  const stale = play(chessFromFen('7k/8/6Q1/8/8/8/8/K7 w - - 0 1'), 'g6f7');
  assert.deepEqual(stale.result, { winner: null, reason: 'pat' });
});

test('draws: threefold repetition, 50 moves, too little material', () => {
  let s = chessNewGame();
  const knights = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
  s = play(s, ...knights);
  assert.equal(s.result, null);
  s = play(s, ...knights);
  assert.deepEqual(s.result, { winner: null, reason: 'repetition' });

  const fifty = chessFromFen('7k/8/8/8/8/8/8/K6R w - - 99 80');
  assert.deepEqual(play(fifty, 'h1h2').result, { winner: null, reason: 'cinquante' });
  // A pawn move or a capture starts the count again.
  assert.equal(chessFromFen('7k/8/8/8/8/8/P7/K7 w - - 99 80').halfmove, 99);
  assert.equal(play(chessFromFen('7k/8/8/8/8/8/P7/K7 w - - 99 80'), 'a2a3').result, null);

  // King and bishop against king; bishops on the same color.
  assert.deepEqual(play(chessFromFen('7k/8/8/8/8/8/6r1/K5B1 w - - 0 1'), 'g1h2').result, null);
  assert.deepEqual(play(chessFromFen('7k/8/8/8/8/8/6r1/KB6 w - - 0 1'), 'b1g6').result, null);
  assert.deepEqual(play(chessFromFen('7k/8/8/8/8/8/6r1/K6B w - - 0 1'), 'h1g2').result, {
    winner: null,
    reason: 'materiel',
  });
  assert.equal(chessFromFen('k7/8/8/8/8/8/8/K1b1B3 w - - 0 1').result?.reason, 'materiel');
  assert.equal(chessFromFen('k7/8/8/8/8/8/8/K1b2B2 w - - 0 1').result, null);
  assert.equal(chessFromFen('k7/8/8/8/8/8/8/K1n1N3 w - - 0 1').result, null);
});

test('resigning gives the game to the other player', () => {
  const s = chessResign(chessNewGame(), 0);
  assert.deepEqual(s.result, { winner: 1, reason: 'abandon' });
  assert.throws(() => chessResign(s, 1), /finie/);
});

test('notation: disambiguation, captures and checks', () => {
  const s = chessFromFen('4k3/8/8/8/8/8/4K3/R6R w - - 0 1');
  assert.equal(play(s, 'a1d1').moves[0], 'Rad1');
  assert.equal(play(s, 'h1h8').moves[0], 'Rh8+');
  const ranks = chessFromFen('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1');
  assert.equal(play(ranks, 'a1a3').moves[0], 'R1a3');
});

test('every robot level finds a mate in one and plays legal moves quickly', () => {
  // Back-rank mate: Ra8#.
  const s = chessFromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  for (const level of ['moyen', 'difficile'] as ChessLevel[]) {
    const m = chessBotMove(s, level, seeded(3));
    assert.deepEqual({ from: m.from, to: m.to }, { from: 'a1', to: 'a8' }, level);
  }
  // The hard robot does not leave its queen hanging.
  const queen = chessFromFen('4k3/8/8/3q4/8/8/3R4/4K3 b - - 0 1');
  const saved = chessBotMove(queen, 'difficile', seeded(5));
  assert.notEqual(saved.from + saved.to, 'd5d4');
  assert.equal(saved.from, 'd5');
  for (const level of ['facile', 'moyen', 'difficile'] as ChessLevel[]) {
    let g = chessNewGame();
    const start = Date.now();
    for (let i = 0; i < 16 && !g.result; i++) g = chessPlay(g, chessBotMove(g, level, seeded(i + 1)));
    assert.equal(g.moves.length, 16);
    assert.ok(Date.now() - start < 16 * 1500, `${level} trop lent`);
  }
});

test('robots against each other always end the game', () => {
  let g = chessNewGame();
  const rng = seeded(11);
  for (let i = 0; i < 600 && !g.result; i++)
    g = chessPlay(g, chessBotMove(g, i % 2 ? 'facile' : 'moyen', rng));
  assert.ok(g.result, 'la partie ne finit pas');
});
