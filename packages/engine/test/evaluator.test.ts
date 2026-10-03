import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareScores, evaluate } from '../src/evaluator.ts';

const name = (cards: string) => evaluate(cards.split(' ')).name;
const cmp = (a: string, b: string) =>
  Math.sign(compareScores(evaluate(a.split(' ')).score, evaluate(b.split(' ')).score));

test('reconnaît chaque catégorie', () => {
  assert.equal(name('As Ks Qs Js Ts 2d 3c'), 'Quinte flush');
  assert.equal(name('9h 9d 9s 9c Kd 2c 3h'), 'Carré');
  assert.equal(name('9h 9d 9s Kc Kd 2c 3h'), 'Full');
  assert.equal(name('2h 7h 9h Jh Kh Ad 3c'), 'Couleur');
  assert.equal(name('5d 6c 7h 8s 9d Kc 2h'), 'Quinte');
  assert.equal(name('Ah 2d 3c 4s 5h Kc 9d'), 'Quinte');
  assert.equal(name('7h 7d 7s Kc 2d 4c 9h'), 'Brelan');
  assert.equal(name('7h 7d Ks Kc 2d 4c 9h'), 'Double paire');
  assert.equal(name('7h 7d Ks Qc 2d 4c 9h'), 'Paire');
  assert.equal(name('7h 3d Ks Qc 2d 4c 9h'), 'Hauteur');
});

test('départage correctement', () => {
  assert.equal(cmp('Ah 2d 3c 4s 5h', '2h 3d 4c 5s 6h'), -1); // la roue est la plus petite quinte
  assert.equal(cmp('Ah Ad Kc Qs 9h', 'Ac As Kd Qh 8c'), 1); // kicker
  assert.equal(cmp('Kh Kd 2c 2s 9h', 'Qh Qd Jc Js Ah'), 1); // double paire, paire haute
  assert.equal(cmp('As Ks Qs Js 9s', 'Ah Kh Qh Jh 9h'), 0); // égalité exacte
  assert.equal(cmp('2h 2d 2c 3s 3h', 'Ah Kh Qh Jh 9h'), 1); // full bat couleur
});
