import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOmaha } from '../src/evaluator.ts';
import { chooseBotAction } from '../src/bot.ts';
import { type HandState, applyAction, legalActions, startHand } from '../src/game.ts';

test('Omaha : exactement deux cartes de la main', () => {
  // Four hearts on the board but only one in hand: no flush in Omaha.
  assert.notEqual(evaluateOmaha(['Ah', 'Kc', 'Qd', 'Js'], ['2h', '5h', '8h', 'Th', '3c']).name, 'Couleur');
  // Two hearts in hand make the flush.
  assert.equal(evaluateOmaha(['Ah', '9h', 'Qd', 'Js'], ['2h', '5h', '8h', 'Th', '3c']).name, 'Couleur');
  // Four aces in hand only make a pair: just two of them can be used.
  assert.equal(evaluateOmaha(['As', 'Ad', 'Ac', 'Ah'], ['2s', '7d', '9c', 'Jh', '4s']).name, 'Paire');
});

test('Omaha : quatre cartes chacun et mise limitée au pot', () => {
  const s = startHand({
    seats: [100, 1000, 1000].map((stack, i) => ({ id: `p${i}`, name: `J${i}`, stack })),
    dealer: 0,
    smallBlind: 10,
    bigBlind: 20,
    variant: 'omaha',
  });
  assert.equal(s.players.every((p) => p.hole.length === 4), true);
  // First to act after the blinds: pot 30, 20 to call, so a pot raise goes to 20 + 30 + 20 = 70.
  assert.deepEqual(legalActions(s, 'p0')!.raise, { min: 40, max: 70 });
  assert.throws(() => applyAction(s, 'p0', { type: 'raise', to: 71 }));
  // "All-in" means the biggest raise allowed.
  const after = applyAction(s, 'p0', { type: 'allin' });
  assert.equal(after.players[0].bet, 70);
});

test('Omaha : des robots jouent des parties entières', () => {
  for (let k = 0; k < 15; k++) {
    let hand: HandState = startHand({
      seats: [300, 500, 200].map((stack, i) => ({ id: `b${i}`, name: `R${i}`, stack })),
      dealer: k % 3,
      smallBlind: 5,
      bigBlind: 10,
      variant: 'omaha',
    });
    const before = hand.players.reduce((s, p) => s + p.stack + p.totalBet, 0);
    while (hand.street !== 'finished') {
      const id = hand.players[hand.toAct].id;
      hand = applyAction(hand, id, chooseBotAction(hand, id));
    }
    assert.equal(hand.players.reduce((s, p) => s + p.stack, 0), before);
    for (const r of Object.values(hand.showdown)) assert.equal(r.cards.length, 5);
  }
});
