import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type P4Level,
  type P4State,
  P4_COLS,
  P4_ROWS,
  p4BotMove,
  p4Drop,
  p4DropRow,
  p4Finished,
  p4LegalColumns,
  p4NewGame,
  p4NextRound,
} from '../src/puissance4.ts';

function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

/** Plays the columns in order, players alternating. */
function play(cols: number[], state: P4State = p4NewGame()): P4State {
  return cols.reduce(p4Drop, state);
}

test('les jetons tombent en bas de la colonne et les joueurs alternent', () => {
  let s = p4NewGame();
  assert.equal(s.current, 0);
  s = p4Drop(s, 3);
  assert.equal(s.board[3][0], 0);
  assert.deepEqual(s.lastMove, { col: 3, row: 0 });
  assert.equal(s.current, 1);
  s = p4Drop(s, 3);
  assert.equal(s.board[3][1], 1);
  assert.equal(p4DropRow(s.board, 3), 2);
  assert.equal(s.current, 0);
  assert.equal(s.moves, 2);
});

test('une colonne pleine est refusée', () => {
  const s = play([0, 0, 0, 0, 0, 0]);
  assert.equal(p4DropRow(s.board, 0), -1);
  assert.throws(() => p4Drop(s, 0), /pleine/);
  assert.throws(() => p4Drop(s, 7), /inconnue/);
  assert.deepEqual(p4LegalColumns(s), [1, 2, 3, 4, 5, 6]);
});

test('alignement horizontal', () => {
  const s = play([0, 0, 1, 1, 2, 2, 3]);
  assert.equal(s.winner, 0);
  assert.deepEqual(s.winLine, [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  assert.deepEqual(s.scores, [1, 0]);
  assert.deepEqual(p4LegalColumns(s), []);
  assert.throws(() => p4Drop(s, 4), /finie/);
});

test('alignement vertical', () => {
  const s = play([4, 5, 4, 5, 4, 5, 4]);
  assert.equal(s.winner, 0);
  assert.equal(s.winLine!.length, 4);
  assert.ok(s.winLine!.every(([c]) => c === 4));
});

test('alignements en diagonale, dans les deux sens', () => {
  // Rising diagonal for red: (0,0) (1,1) (2,2) (3,3).
  const up = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
  assert.equal(up.winner, 0);
  assert.deepEqual(up.winLine, [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
  ]);
  // Falling diagonal for red: (3,0) (2,1) (1,2) (0,3).
  const down = play([3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0]);
  assert.equal(down.winner, 0);
  assert.deepEqual(down.winLine, [
    [0, 3],
    [1, 2],
    [2, 1],
    [3, 0],
  ]);
});

test('cinq jetons alignés d’un coup : toute la ligne est surlignée', () => {
  // Red fills the gap in the middle of X X _ X X.
  const s = play([0, 0, 1, 1, 3, 3, 4, 4, 2]);
  assert.equal(s.winner, 0);
  assert.equal(s.winLine!.length, 5);
});

test('grille pleine sans alignement : match nul', () => {
  // Columns filled in pairs so that no four ever line up.
  const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2];
  order.push(4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6);
  const s = play(order);
  assert.equal(s.moves, P4_COLS * P4_ROWS);
  assert.equal(s.winner, null);
  assert.equal(s.draw, true);
  assert.equal(s.draws, 1);
  assert.ok(p4Finished(s));
});

test('manche suivante : score gardé, l’autre joueur commence', () => {
  const s = play([0, 0, 1, 1, 2, 2, 3]);
  const next = p4NextRound(s);
  assert.equal(next.round, 2);
  assert.equal(next.starter, 1);
  assert.equal(next.current, 1);
  assert.deepEqual(next.scores, [1, 0]);
  assert.equal(next.moves, 0);
  assert.ok(next.board.every((c) => c.every((v) => v === null)));
  assert.throws(() => p4NextRound(next), /pas finie/);
  // Yellow wins round 2.
  const after = play([6, 0, 6, 1, 6, 2, 6], next);
  assert.equal(after.winner, 1);
  assert.deepEqual(after.scores, [1, 1]);
});

test('robot : gagne quand il peut, à tous les niveaux', () => {
  // Red to move, three in a row at the bottom.
  const s = play([0, 0, 1, 1, 2, 2]);
  for (const level of ['facile', 'moyen', 'difficile'] as P4Level[])
    assert.equal(p4BotMove(s, level, seeded(1)), 3);
});

test('robot moyen et difficile : bloquent la menace adverse', () => {
  // Yellow to move, red threatens to complete the bottom row in column 3.
  const s = play([0, 6, 1, 6, 2]);
  for (const level of ['moyen', 'difficile'] as P4Level[])
    for (let seed = 0; seed < 5; seed++) assert.equal(p4BotMove(s, level, seeded(seed)), 3);
});

test('robot difficile : voit une double menace à venir', () => {
  // Red has 1 and 2 at the bottom with 0, 3 and 4 open: playing 3 makes _ X X X _ unstoppable.
  const s = play([1, 1, 2, 2]);
  assert.equal(p4BotMove(s, 'difficile', seeded(3)), 3);
});

test('robot difficile : bat souvent le robot facile, et répond vite', () => {
  let wins = 0;
  let slowest = 0;
  for (let g = 0; g < 10; g++) {
    const rng = seeded(100 + g);
    let s = p4NewGame((g % 2) as 0 | 1);
    while (!p4Finished(s)) {
      const t = Date.now();
      const col = p4BotMove(s, s.current === 0 ? 'difficile' : 'facile', rng);
      if (s.current === 0) slowest = Math.max(slowest, Date.now() - t);
      s = p4Drop(s, col);
    }
    if (s.winner === 0) wins++;
  }
  assert.ok(wins >= 9, `difficile n'a gagné que ${wins} parties sur 10`);
  assert.ok(slowest < 1500, `coup trop lent : ${slowest} ms`);
});

test('fuzz : des centaines de parties entre robots vont au bout', () => {
  const levels: P4Level[] = ['facile', 'moyen', 'difficile'];
  const rng = seeded(42);
  let s = p4NewGame();
  for (let g = 0; g < 300; g++) {
    // Mostly quick levels, with some deep searches.
    const pick = () => levels[g % 30 === 0 ? 2 : rng(2)];
    const red = pick();
    const yellow = pick();
    for (let steps = 0; !p4Finished(s); steps++) {
      assert.ok(steps <= P4_COLS * P4_ROWS, 'la manche ne se termine pas');
      const legal = p4LegalColumns(s);
      const col = rng(5) === 0 ? legal[rng(legal.length)] : p4BotMove(s, s.current === 0 ? red : yellow, rng);
      assert.ok(legal.includes(col));
      s = p4Drop(s, col);
    }
    const tokens = s.board.flat().filter((v) => v !== null).length;
    assert.equal(tokens, s.moves);
    assert.ok(s.board.every((c) => c.length === P4_ROWS));
    if (s.winner !== null) {
      assert.ok(s.winLine && s.winLine.length >= 4);
      assert.ok(s.winLine.every(([c, r]) => s.board[c][r] === s.winner));
    } else assert.equal(s.moves, P4_COLS * P4_ROWS);
    s = p4NextRound(s);
  }
  assert.equal(s.round, 301);
  assert.equal(s.scores[0] + s.scores[1] + s.draws, 300);
});
