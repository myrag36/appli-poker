import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type YamsBox,
  type YamsState,
  YAMS_BOXES,
  yamsApply,
  yamsBonus,
  yamsBotHolds,
  yamsBotMove,
  yamsLegalMoves,
  yamsNewGame,
  yamsOpenBoxes,
  yamsRanking,
  yamsScoreBox,
  yamsTotal,
  yamsUpperTotal,
} from '../src/yams.ts';

function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

/** An Rng that hands out the given faces (1..6) in order. */
function fixed(faces: number[]) {
  let i = 0;
  return () => faces[i++ % faces.length] - 1;
}

const s = yamsScoreBox;

test('section du haut : somme des dés de la valeur', () => {
  assert.equal(s([1, 1, 2, 3, 1], 'ones'), 3);
  assert.equal(s([2, 2, 2, 2, 5], 'twos'), 8);
  assert.equal(s([3, 1, 2, 4, 5], 'threes'), 3);
  assert.equal(s([4, 4, 1, 1, 1], 'fours'), 8);
  assert.equal(s([5, 5, 5, 5, 5], 'fives'), 25);
  assert.equal(s([6, 6, 6, 1, 2], 'sixes'), 18);
  assert.equal(s([1, 2, 3, 4, 5], 'sixes'), 0);
});

test('brelan et carré : somme de tous les dés', () => {
  assert.equal(s([3, 3, 3, 4, 5], 'brelan'), 18);
  assert.equal(s([3, 3, 4, 4, 5], 'brelan'), 0);
  assert.equal(s([2, 2, 2, 2, 6], 'brelan'), 14);
  assert.equal(s([2, 2, 2, 2, 6], 'carre'), 14);
  assert.equal(s([2, 2, 2, 6, 6], 'carre'), 0);
  assert.equal(s([6, 6, 6, 6, 6], 'carre'), 30);
  assert.equal(s([6, 6, 6, 6, 6], 'brelan'), 30);
});

test('full : 3 + 2, et un Yams compte comme full', () => {
  assert.equal(s([2, 2, 3, 3, 3], 'full'), 25);
  assert.equal(s([4, 4, 4, 4, 1], 'full'), 0);
  assert.equal(s([1, 2, 3, 4, 5], 'full'), 0);
  assert.equal(s([5, 5, 5, 5, 5], 'full'), 25);
});

test('suites', () => {
  assert.equal(s([1, 2, 3, 4, 6], 'petiteSuite'), 30);
  assert.equal(s([3, 4, 5, 6, 6], 'petiteSuite'), 30);
  assert.equal(s([2, 3, 4, 5, 2], 'petiteSuite'), 30);
  assert.equal(s([1, 2, 3, 5, 6], 'petiteSuite'), 0);
  assert.equal(s([1, 2, 3, 4, 5], 'petiteSuite'), 30);
  assert.equal(s([1, 2, 3, 4, 5], 'grandeSuite'), 40);
  assert.equal(s([6, 5, 4, 3, 2], 'grandeSuite'), 40);
  assert.equal(s([1, 2, 3, 4, 6], 'grandeSuite'), 0);
  assert.equal(s([3, 4, 5, 6, 6], 'grandeSuite'), 0);
});

test('yams et chance', () => {
  assert.equal(s([4, 4, 4, 4, 4], 'yams'), 50);
  assert.equal(s([4, 4, 4, 4, 3], 'yams'), 0);
  assert.equal(s([1, 2, 3, 4, 6], 'chance'), 16);
  assert.equal(s([6, 6, 6, 6, 6], 'chance'), 30);
});

test('dés pas encore lancés : rien ne compte', () => {
  for (const b of YAMS_BOXES) assert.equal(s([0, 0, 0, 0, 0], b), 0);
});

test('bonus de 35 à partir de 63 pile', () => {
  const at63 = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
  assert.equal(yamsUpperTotal(at63), 63);
  assert.equal(yamsBonus(at63), 35);
  assert.equal(yamsTotal(at63), 98);
  const at62 = { ...at63, ones: 2 };
  assert.equal(yamsBonus(at62), 0);
  assert.equal(yamsTotal(at62), 62);
  assert.equal(yamsTotal({ ...at63, yams: 50, chance: 20 }), 168);
});

test('trois lancers au maximum, puis il faut marquer', () => {
  const rng = seeded(3);
  let g = yamsNewGame([{ name: 'A' }, { name: 'B' }]);
  assert.deepEqual(yamsLegalMoves(g), [{ type: 'roll' }]);
  assert.throws(() => yamsApply(g, { type: 'score', box: 'chance' }, rng));
  assert.throws(() => yamsApply(g, { type: 'toggle', index: 0 }, rng));
  g = yamsApply(g, { type: 'roll' }, rng);
  assert.equal(g.rollsLeft, 2);
  assert.ok(g.dice.every((d) => d >= 1 && d <= 6));
  g = yamsApply(g, { type: 'roll' }, rng);
  g = yamsApply(g, { type: 'roll' }, rng);
  assert.equal(g.rollsLeft, 0);
  assert.throws(() => yamsApply(g, { type: 'roll' }, rng));
  assert.throws(() => yamsApply(g, { type: 'toggle', index: 1 }, rng));
  assert.ok(yamsLegalMoves(g).every((m) => m.type === 'score'));
  assert.equal(yamsLegalMoves(g).length, 13);
  g = yamsApply(g, { type: 'score', box: 'chance' }, rng);
  assert.equal(g.current, 1);
  assert.equal(g.rollsLeft, 3);
  assert.deepEqual(g.held, [false, false, false, false, false]);
});

test('les dés gardés ne bougent pas', () => {
  let g = yamsNewGame([{ name: 'A' }]);
  g = yamsApply(g, { type: 'roll' }, fixed([6, 6, 2, 3, 6]));
  g = yamsApply(g, { type: 'toggle', index: 0 }, fixed([1]));
  g = yamsApply(g, { type: 'toggle', index: 1 }, fixed([1]));
  g = yamsApply(g, { type: 'toggle', index: 4 }, fixed([1]));
  g = yamsApply(g, { type: 'toggle', index: 2 }, fixed([1]));
  g = yamsApply(g, { type: 'toggle', index: 2 }, fixed([1]));
  assert.deepEqual(g.held, [true, true, false, false, true]);
  g = yamsApply(g, { type: 'roll' }, fixed([6, 1]));
  assert.deepEqual(g.dice, [6, 6, 6, 1, 6]);
  g = yamsApply(g, { type: 'toggle', index: 2 }, fixed([1]));
  g = yamsApply(g, { type: 'roll' }, fixed([6]));
  assert.deepEqual(g.dice, [6, 6, 6, 6, 6]);
  g = yamsApply(g, { type: 'score', box: 'yams' }, fixed([1]));
  assert.equal(g.players[0].scores.yams, 50);
  assert.deepEqual(g.lastScore, { player: 0, box: 'yams', points: 50 });
});

test('on ne relance pas si tous les dés sont gardés', () => {
  let g = yamsNewGame([{ name: 'A' }]);
  g = yamsApply(g, { type: 'roll' }, fixed([1, 2, 3, 4, 5]));
  for (let i = 0; i < 5; i++) g = yamsApply(g, { type: 'toggle', index: i }, fixed([1]));
  assert.throws(() => yamsApply(g, { type: 'roll' }, fixed([1])));
  assert.ok(!yamsLegalMoves(g).some((m) => m.type === 'roll'));
});

test('marquer 0, et pas deux fois la même case', () => {
  let g = yamsNewGame([{ name: 'A' }, { name: 'B' }]);
  g = yamsApply(g, { type: 'roll' }, fixed([1, 2, 3, 5, 6]));
  g = yamsApply(g, { type: 'score', box: 'yams' }, fixed([1]));
  assert.equal(g.players[0].scores.yams, 0);
  assert.equal(yamsOpenBoxes(g.players[0].scores).length, 12);
  g = yamsApply(g, { type: 'roll' }, fixed([1, 2, 3, 5, 6]));
  g = yamsApply(g, { type: 'score', box: 'yams' }, fixed([1]));
  g = yamsApply(g, { type: 'roll' }, fixed([1, 2, 3, 5, 6]));
  assert.throws(() => yamsApply(g, { type: 'score', box: 'yams' }, fixed([1])), /déjà/);
});

function playOut(g: YamsState, pick: (g: YamsState) => YamsBox, faces: number[]) {
  while (!g.finished) {
    g = yamsApply(g, { type: 'roll' }, fixed(faces));
    g = yamsApply(g, { type: 'score', box: pick(g) }, fixed(faces));
  }
  return g;
}

test('fin de partie quand tout le monde a rempli ses 13 cases, égalités partagées', () => {
  // Everyone rolls the same dice and fills the boxes in the same order: a three-way tie.
  let g = yamsNewGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
  g = playOut(g, (g) => yamsOpenBoxes(g.players[g.current].scores)[0], [2, 2, 2, 3, 3]);
  assert.ok(g.finished);
  assert.deepEqual(yamsLegalMoves(g), []);
  assert.throws(() => yamsApply(g, { type: 'roll' }, fixed([1])));
  assert.ok(g.players.every((p) => yamsOpenBoxes(p.scores).length === 0));
  const r = yamsRanking(g);
  assert.ok(r.every((e) => e.place === 1));
  assert.equal(r[0].total, yamsTotal(g.players[0].scores));
});

test('classement : meilleur total devant, ex aequo à la même place', () => {
  const g = yamsNewGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]);
  const withScores = (scores: Record<string, number>[]): YamsState => ({
    ...g,
    players: g.players.map((p, i) => ({ ...p, scores: scores[i] })),
  });
  const r = yamsRanking(withScores([{ chance: 20 }, { chance: 25 }, { chance: 20 }, { yams: 50 }]));
  assert.deepEqual(
    r.map((e) => [e.name, e.total, e.place]),
    [
      ['D', 50, 1],
      ['B', 25, 2],
      ['A', 20, 3],
      ['C', 20, 3],
    ],
  );
});

test('le robot garde les bons dés', () => {
  // Four sixes with the Yams box open: keep the sixes.
  assert.deepEqual(yamsBotHolds([6, 6, 2, 6, 6], {}), [true, true, false, true, true]);
  // A grande suite already: keep everything.
  assert.deepEqual(yamsBotHolds([1, 2, 3, 4, 5], {}), [true, true, true, true, true]);
  // Petite suite open, others gone: keep 2-3-4-5 and reroll a duplicate.
  const held = yamsBotHolds([2, 3, 4, 5, 5], { petiteSuite: undefined, grandeSuite: 40, yams: 0 });
  assert.equal(held.filter(Boolean).length >= 4, true);
});

test('le robot marque le Yams et vide un zéro dans une case peu utile', () => {
  let g = yamsNewGame([{ name: 'R', bot: true }]);
  g = yamsApply(g, { type: 'roll' }, fixed([3, 3, 3, 3, 3]));
  assert.deepEqual(yamsBotMove(g), { type: 'score', box: 'yams' });
  g = yamsNewGame([{ name: 'R', bot: true }]);
  g = yamsApply(g, { type: 'roll' }, fixed([1, 2, 3, 5, 6]));
  g = yamsApply(g, { type: 'roll' }, fixed([1, 2, 3, 5, 6]));
  g = yamsApply(g, { type: 'roll' }, fixed([1, 2, 3, 5, 6]));
  g = { ...g, players: [{ ...g.players[0], scores: { chance: 20, brelan: 20 } }] };
  const m = yamsBotMove(g);
  assert.equal(m.type, 'score');
  assert.ok(m.type === 'score' && m.box !== 'chance');
});

test('fuzz : 200 parties de robots jusqu’au bout', () => {
  const rng = seeded(42);
  let totals = 0;
  let games = 0;
  for (let n = 0; n < 200; n++) {
    const count = 1 + (n % 6);
    let g = yamsNewGame(Array.from({ length: count }, (_, i) => ({ name: `R${i}`, bot: true })));
    let steps = 0;
    while (!g.finished) {
      const move = yamsBotMove(g);
      const legal = yamsLegalMoves(g);
      assert.ok(
        legal.some((m) => JSON.stringify(m) === JSON.stringify(move)),
        `coup illégal ${JSON.stringify(move)}`,
      );
      const before = g;
      g = yamsApply(g, move, rng);
      assert.ok(g.rollsLeft >= 0 && g.rollsLeft <= 3);
      if (move.type === 'score') {
        const p = g.players[before.current];
        assert.equal(
          Object.keys(p.scores).length,
          Object.keys(before.players[before.current].scores).length + 1,
        );
      }
      assert.ok(++steps < count * 13 * 30, 'la partie ne finit pas');
    }
    for (const p of g.players) {
      assert.equal(yamsOpenBoxes(p.scores).length, 0);
      for (const b of YAMS_BOXES) assert.ok((p.scores[b] ?? -1) >= 0);
      totals += yamsTotal(p.scores);
      games++;
    }
    const r = yamsRanking(g);
    assert.equal(r[0].place, 1);
    assert.equal(r[0].total, Math.max(...g.players.map((p) => yamsTotal(p.scores))));
  }
  // A sensible robot averages well above a random filler (~ 100 points).
  assert.ok(totals / games > 170, `moyenne ${totals / games}`);
});
