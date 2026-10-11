import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type DamesLevel,
  type DamesMove,
  type DamesState,
  DAMES_START,
  damesBotMove,
  damesCount,
  damesFinished,
  damesLegalMoves,
  damesNewGame,
  damesPlay,
  damesRowCol,
  damesSquareAt,
} from '../src/dames.ts';
import { damesOnline as D } from '../src/online-dames.ts';
import { ONLINE_GAMES, isOnlineGame } from '../src/online.ts';

const seeded = (seed: number) => (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};

/** The square at (row, col), which must be a dark one. */
function sq(row: number, col: number): number {
  const s = damesSquareAt(row, col);
  assert.ok(s >= 0, `(${row}, ${col}) n’est pas une case noire`);
  return s;
}

/** A board with the given pieces, as [row, col] per piece letter (w, W, b, B). */
function board(pieces: Partial<Record<'w' | 'W' | 'b' | 'B', [number, number][]>>): string {
  const cells = Array<string>(50).fill('.');
  for (const [piece, list] of Object.entries(pieces)) for (const [r, c] of list!) cells[sq(r, c)] = piece;
  return cells.join('');
}

const at = (s: DamesState, r: number, c: number) => s.board[sq(r, c)];
const play = (s: DamesState, from: [number, number], ...path: [number, number][]) =>
  damesPlay(s, { from: sq(...from), path: path.map((p) => sq(...p)) });
const simplify = (moves: DamesMove[]) =>
  moves
    .map((m) => ({ from: m.from, path: m.path, captures: [...m.captures].sort((a, b) => a - b) }))
    .sort((a, b) => a.from - b.from || a.path.join().localeCompare(b.path.join()));

test('geometry: 50 dark squares, numbered row by row', () => {
  for (let s = 0; s < 50; s++) {
    const { row, col } = damesRowCol(s);
    assert.equal((row + col) % 2, 1);
    assert.equal(damesSquareAt(row, col), s);
  }
  assert.deepEqual(damesRowCol(0), { row: 0, col: 1 });
  assert.deepEqual(damesRowCol(5), { row: 1, col: 0 });
  assert.equal(damesSquareAt(0, 0), -1);
  assert.equal(damesSquareAt(10, 1), -1);
});

test('start: 20 men each, White moves first with 9 possible moves', () => {
  const g = damesNewGame();
  assert.equal(g.board, DAMES_START);
  assert.deepEqual(damesCount(g.board, 0), { men: 20, kings: 0 });
  assert.deepEqual(damesCount(g.board, 1), { men: 20, kings: 0 });
  assert.equal(g.current, 0);
  const moves = damesLegalMoves(g);
  assert.equal(moves.length, 9);
  for (const m of moves) {
    assert.equal(m.captures.length, 0);
    assert.equal(damesRowCol(m.from).row, 6);
    assert.equal(damesRowCol(m.path[0]).row, 5);
  }
  const after = damesPlay(g, moves[0]);
  assert.equal(after.current, 1);
  assert.ok(damesLegalMoves(after).every((m) => damesRowCol(m.path[0]).row === 4));
});

test('men move forward only, but capture backward too, and capturing is mandatory', () => {
  // White man at (5,4), a black man just behind it.
  const g = damesNewGame(
    board({
      w: [[5, 4]],
      b: [
        [6, 5],
        [0, 1],
      ],
    }),
  );
  assert.deepEqual(simplify(damesLegalMoves(g)), [
    { from: sq(5, 4), path: [sq(7, 6)], captures: [sq(6, 5)] },
  ]);
  assert.throws(() => play(g, [5, 4], [4, 3]), /Prise obligatoire/);
  const after = play(g, [5, 4], [7, 6]);
  assert.equal(at(after, 7, 6), 'w');
  assert.equal(at(after, 6, 5), '.');
  assert.equal(at(after, 5, 4), '.');
  assert.equal(after.current, 1);
  // Without anything to take, a man only steps forward.
  const quiet = damesNewGame(board({ w: [[5, 4]], b: [[0, 1]] }));
  assert.deepEqual(
    damesLegalMoves(quiet)
      .map((m) => m.path[0])
      .sort((a, b) => a - b),
    [sq(4, 3), sq(4, 5)].sort((a, b) => a - b),
  );
  assert.throws(() => play(quiet, [5, 4], [6, 3]), /Coup impossible/);
});

test('maximum capture: only the sequence taking the most pieces may be played', () => {
  const g = damesNewGame(
    board({
      w: [
        [7, 0],
        [9, 6],
      ],
      b: [
        [6, 1],
        [8, 7],
        [6, 7],
        [0, 1],
      ],
    }),
  );
  assert.deepEqual(simplify(damesLegalMoves(g)), [
    { from: sq(9, 6), path: [sq(7, 8), sq(5, 6)], captures: [sq(6, 7), sq(8, 7)].sort((a, b) => a - b) },
  ]);
  // Taking the single piece instead is refused, and so is stopping halfway.
  assert.throws(() => play(g, [7, 0], [5, 2]), /2 pièces/);
  assert.throws(() => play(g, [9, 6], [7, 8]), /2 pièces/);
  const after = play(g, [9, 6], [7, 8], [5, 6]);
  assert.equal(at(after, 5, 6), 'w');
  assert.equal(at(after, 8, 7), '.');
  assert.equal(at(after, 6, 7), '.');
  assert.equal(at(after, 6, 1), 'b');
  assert.deepEqual(after.lastMove?.captures, [sq(8, 7), sq(6, 7)]);
});

test('multi-jump: a loop back to the starting square, each piece taken once', () => {
  const g = damesNewGame(
    board({
      w: [[6, 3]],
      b: [
        [5, 2],
        [3, 2],
        [3, 4],
        [5, 4],
        [0, 1],
      ],
    }),
  );
  const moves = simplify(damesLegalMoves(g));
  assert.equal(moves.length, 2);
  for (const m of moves) {
    assert.equal(m.captures.length, 4);
    assert.equal(m.path.length, 4);
    assert.equal(m.path[3], sq(6, 3));
  }
  const after = play(g, [6, 3], [4, 1], [2, 3], [4, 5], [6, 3]);
  assert.equal(after.board, board({ w: [[6, 3]], b: [[0, 1]] }));
});

test('captured pieces stay on the board until the end of the sequence and cannot be jumped twice', () => {
  // A white king could take (5,4), then come back over it: not allowed, it is still there.
  const g = damesNewGame(
    board({
      W: [[7, 2]],
      b: [
        [5, 4],
        [2, 5],
        [0, 1],
      ],
    }),
  );
  const moves = damesLegalMoves(g);
  assert.ok(moves.length > 0);
  for (const m of moves) {
    assert.equal(new Set(m.captures).size, m.captures.length);
    assert.ok(m.captures.length <= 2);
  }
});

test('flying king: takes from afar, lands anywhere beyond, and must pick a landing that goes on', () => {
  const g = damesNewGame(
    board({
      W: [[9, 0]],
      b: [
        [5, 4],
        [2, 5],
      ],
    }),
  );
  // Only landing on (3,6) lets the king take (2,5) next; it may then stop on (1,4) or (0,3).
  assert.deepEqual(simplify(damesLegalMoves(g)), [
    { from: sq(9, 0), path: [sq(3, 6), sq(0, 3)], captures: [sq(2, 5), sq(5, 4)].sort((a, b) => a - b) },
    { from: sq(9, 0), path: [sq(3, 6), sq(1, 4)], captures: [sq(2, 5), sq(5, 4)].sort((a, b) => a - b) },
  ]);
  assert.throws(() => play(g, [9, 0], [4, 5]), /2 pièces/);
  const after = play(g, [9, 0], [3, 6], [0, 3]);
  assert.equal(at(after, 0, 3), 'W');
  assert.equal(after.winner, 0);
  assert.equal(after.end, 'pieces');

  // With a single piece to take, every empty square beyond it will do.
  const one = damesNewGame(
    board({
      W: [[9, 0]],
      b: [
        [5, 4],
        [0, 1],
      ],
    }),
  );
  assert.deepEqual(
    damesLegalMoves(one)
      .map((m) => m.path[0])
      .sort((a, b) => a - b),
    [sq(4, 5), sq(3, 6), sq(2, 7), sq(1, 8), sq(0, 9)].sort((a, b) => a - b),
  );
  // Two pieces side by side cannot be jumped; the king just moves.
  const wall = damesNewGame(
    board({
      W: [[9, 0]],
      b: [
        [6, 3],
        [5, 4],
      ],
    }),
  );
  const moves = damesLegalMoves(wall);
  assert.ok(moves.every((m) => m.captures.length === 0));
  assert.deepEqual(
    moves.map((m) => m.path[0]).sort((a, b) => a - b),
    [sq(8, 1), sq(7, 2)].sort((a, b) => a - b),
  );
});

test('a king moves any distance on its diagonals', () => {
  const g = damesNewGame(board({ W: [[5, 4]], b: [[0, 1]] }));
  // 4 + 4 + 5 + 4 squares around (5,4).
  assert.equal(damesLegalMoves(g).length, 17);
});

test('promotion: only when the move ends on the far row', () => {
  // The man reaches the last row but has to go on taking: it stays a man.
  const through = damesNewGame(
    board({
      w: [[2, 3]],
      b: [
        [1, 4],
        [1, 6],
        [5, 0],
      ],
    }),
  );
  assert.deepEqual(simplify(damesLegalMoves(through)), [
    { from: sq(2, 3), path: [sq(0, 5), sq(2, 7)], captures: [sq(1, 4), sq(1, 6)].sort((a, b) => a - b) },
  ]);
  const passed = play(through, [2, 3], [0, 5], [2, 7]);
  assert.equal(at(passed, 2, 7), 'w');
  assert.equal(passed.promoted, false);

  // Ending there crowns it.
  const crowned = play(
    damesNewGame(
      board({
        w: [[2, 3]],
        b: [
          [1, 4],
          [5, 0],
        ],
      }),
    ),
    [2, 3],
    [0, 5],
  );
  assert.equal(at(crowned, 0, 5), 'W');
  assert.equal(crowned.promoted, true);
  // A simple step onto the last row too, and for Black on the bottom row.
  const step = play(damesNewGame(board({ w: [[1, 2]], b: [[5, 0]] })), [1, 2], [0, 3]);
  assert.equal(at(step, 0, 3), 'W');
  const black = play(damesNewGame(board({ w: [[0, 1]], b: [[8, 1]] }), 1), [8, 1], [9, 0]);
  assert.equal(at(black, 9, 0), 'B');
});

test('a player left without pieces or without a move loses', () => {
  const taken = play(damesNewGame(board({ w: [[5, 4]], b: [[4, 5]] })), [5, 4], [3, 6]);
  assert.equal(taken.winner, 0);
  assert.equal(taken.end, 'pieces');
  assert.ok(damesFinished(taken));
  assert.deepEqual(damesLegalMoves(taken), []);
  assert.throws(() => play(taken, [3, 6], [2, 5]), /finie/);

  // The black man is walled in once White has moved.
  const g = damesNewGame(
    board({
      w: [
        [1, 0],
        [1, 2],
        [2, 3],
        [9, 0],
      ],
      b: [[0, 1]],
    }),
  );
  const blocked = play(g, [9, 0], [8, 1]);
  assert.equal(blocked.winner, 0);
  assert.equal(blocked.end, 'blocked');
});

const kings = board({
  W: [
    [9, 0],
    [9, 2],
  ],
  B: [
    [0, 1],
    [0, 3],
  ],
});

test('draw: 25 moves each with only kings moved and nothing taken', () => {
  const g: DamesState = { ...damesNewGame(kings), quiet: 49 };
  const after = play(g, [9, 0], [8, 1]);
  assert.equal(after.draw, true);
  assert.equal(after.end, 'kings25');
  assert.equal(after.winner, null);
  // A man move resets the count.
  const withMan = {
    ...damesNewGame(
      board({
        W: [[9, 0]],
        w: [[6, 5]],
        B: [
          [0, 1],
          [0, 3],
        ],
      }),
    ),
    quiet: 49,
  };
  const reset = play(withMan, [6, 5], [5, 6]);
  assert.equal(reset.draw, false);
  assert.equal(reset.quiet, 0);
});

test('draw: the same position for the third time', () => {
  let g = damesNewGame(kings);
  const cycle: [[number, number], [number, number]][] = [
    [
      [9, 0],
      [8, 1],
    ],
    [
      [0, 1],
      [1, 0],
    ],
    [
      [8, 1],
      [9, 0],
    ],
    [
      [1, 0],
      [0, 1],
    ],
  ];
  for (let i = 0; i < 8; i++) {
    assert.equal(g.draw, false, `coup ${i}`);
    const [from, to] = cycle[i % 4];
    g = play(g, from, to);
  }
  assert.equal(g.draw, true);
  assert.equal(g.end, 'repetition');
});

test('draw: a lone king against one or two pieces lasts 5 moves each', () => {
  let g = damesNewGame(board({ W: [[9, 0]], B: [[0, 1]] }));
  const cycle: [[number, number], [number, number]][] = [
    [
      [9, 0],
      [8, 1],
    ],
    [
      [0, 1],
      [1, 0],
    ],
    [
      [8, 1],
      [7, 0],
    ],
    [
      [1, 0],
      [2, 1],
    ],
    [
      [7, 0],
      [8, 1],
    ],
    [
      [2, 1],
      [1, 2],
    ],
    [
      [8, 1],
      [9, 0],
    ],
    [
      [1, 2],
      [0, 1],
    ],
    [
      [9, 0],
      [8, 1],
    ],
    [
      [0, 1],
      [1, 0],
    ],
  ];
  for (let i = 0; i < 10; i++) {
    assert.equal(g.draw, false, `coup ${i}`);
    g = play(g, ...cycle[i]);
  }
  assert.equal(g.draw, true);
  assert.equal(g.end, 'endgame');
});

test('moves are checked: wrong piece, unknown square, malformed path', () => {
  const g = damesNewGame();
  assert.throws(() => damesPlay(g, { from: 0, path: [5] }), /pas ton pion/);
  assert.throws(() => damesPlay(g, { from: 50, path: [5] }), /Case inconnue/);
  assert.throws(() => damesPlay(g, { from: 31, path: [] }), /Coup inconnu/);
  assert.throws(() => damesPlay(g, { from: 31, path: [1.5] }), /Case inconnue/);
  assert.throws(() => damesPlay(g, { from: 31, path: [20] }), /Coup impossible/);
});

test('robot: every level plays a legal move, quickly', () => {
  const levels: DamesLevel[] = ['facile', 'moyen', 'difficile'];
  for (const level of levels) {
    let g = damesNewGame();
    for (let i = 0; i < 12 && !damesFinished(g); i++) {
      const started = Date.now();
      const m = damesBotMove(g, level, seeded(i + 3));
      assert.ok(Date.now() - started < 1500, `${level} trop lent`);
      g = damesPlay(g, m);
    }
  }
});

test('robot: takes the most pieces and avoids giving pieces away', () => {
  // Free piece to take: every level must (it is mandatory), the strong ones see the 2-piece shot.
  const g = damesNewGame(
    board({
      w: [
        [7, 0],
        [9, 6],
      ],
      b: [
        [6, 1],
        [8, 7],
        [6, 7],
        [0, 1],
      ],
    }),
  );
  for (const level of ['facile', 'moyen', 'difficile'] as DamesLevel[])
    assert.equal(damesBotMove(g, level, seeded(1)).captures.length, 2);
  // Stepping next to the black man would lose the white man; the robot keeps it safe.
  const safe = damesNewGame(
    board({
      w: [
        [6, 3],
        [9, 8],
      ],
      b: [
        [4, 5],
        [0, 1],
      ],
    }),
  );
  for (const level of ['moyen', 'difficile'] as DamesLevel[])
    for (let seed = 1; seed < 6; seed++) {
      const m = damesBotMove(safe, level, seeded(seed));
      assert.notDeepEqual([m.from, m.path[0]], [sq(6, 3), sq(5, 4)], level);
    }
});

test('robot: the difficult one beats the easy one', () => {
  let wins = 0;
  for (let game = 0; game < 2; game++) {
    let g = damesNewGame();
    const strong = game % 2 === 0 ? 0 : 1;
    while (!damesFinished(g) && g.plies < 300)
      g = damesPlay(
        g,
        damesBotMove(g, g.current === strong ? 'difficile' : 'facile', seeded(game * 100 + g.plies)),
      );
    if (g.winner === strong) wins++;
  }
  assert.equal(wins, 2);
});

test('online: registered for 2 seats, a robot completing the table', () => {
  assert.ok(isOnlineGame('dames'));
  assert.equal(ONLINE_GAMES.dames, D);
  assert.equal(D.maxPlayers, 2);
  assert.equal(D.fillTo, 2);
  assert.deepEqual(D.options({ anything: 1 }), {});
  const seats = [
    { id: 'a', name: 'Alice', bot: false },
    { id: 'b', name: 'Robby', bot: true },
  ];
  assert.throws(() => D.start(seats.slice(0, 1), {}, seeded(1)));
  let s = D.start(seats, {}, seeded(1));
  assert.deepEqual(D.actors(s), [0]);
  assert.throws(() => D.apply(s, 1, { type: 'move', from: 15, path: [20] }, seeded(1)), /ton tour/);
  assert.throws(() => D.apply(s, 0, { type: 'move', from: 31, path: ['20'] }, seeded(1)), /Coup inconnu/);
  assert.throws(() => D.apply(s, 0, { type: 'drop', col: 1 }, seeded(1)), /Coup inconnu/);
  s = D.apply(s, 0, { type: 'move', from: 31, path: [26] }, seeded(1));
  assert.deepEqual(D.actors(s), [1]);
  assert.equal(D.view(s, 0), s);
  for (let i = 0; i < 400 && !D.over(s); i++)
    s = D.apply(s, D.actors(s)[0], D.auto(s, D.actors(s)[0], seeded(i)), seeded(i));
  assert.ok(D.over(s));
  assert.deepEqual(D.actors(s), []);
  assert.ok(D.winners(s).length >= 1);
  assert.equal(D.betweenRounds(s), false);
});
