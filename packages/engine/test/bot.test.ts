import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botName, chooseBotAction, equity } from '../src/bot.ts';
import { type HandState, applyAction, legalActions, startHand } from '../src/game.ts';

/** Seeded generator so the tests always see the same games. */
function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

test('chances : une paire d’as domine, une main faible non', () => {
  const rng = seeded(1);
  assert.ok(equity(['As', 'Ad'], [], 1, rng) > 0.75);
  assert.ok(equity(['7c', '2d'], [], 1, rng) < 0.4);
  // A made straight flush on the river cannot lose.
  assert.equal(equity(['9h', '8h'], ['7h', '6h', '5h', 'Kc', '2d'], 3, rng), 1);
});

test('les robots jouent des parties entières sans coup interdit', () => {
  const rng = seeded(7);
  for (let game = 0; game < 40; game++) {
    let hand: HandState = startHand({
      seats: [100, 250, 80, 400].map((stack, i) => ({ id: `b${i}`, name: `Robot ${i}`, stack })),
      dealer: game % 4,
      smallBlind: 5,
      bigBlind: 10,
      rng,
    });
    const before = hand.players.reduce((s, p) => s + p.stack + p.totalBet, 0);
    let moves = 0;
    while (hand.street !== 'finished') {
      const id = hand.players[hand.toAct].id;
      assert.ok(legalActions(hand, id));
      hand = applyAction(hand, id, chooseBotAction(hand, id, rng));
      assert.ok(++moves < 200, 'la main doit finir');
    }
    assert.equal(hand.players.reduce((s, p) => s + p.stack, 0), before);
  }
});

test('avec une main très forte le robot relance, avec une main nulle face à un gros tapis il se couche', () => {
  const rng = seeded(3);
  let strong = 0;
  let folds = 0;
  for (let k = 0; k < 30; k++) {
    // Heads-up, the dealer (b0) acts first preflop.
    const deal = startHand({
      seats: [{ id: 'b0', name: 'A', stack: 1000 }, { id: 'b1', name: 'B', stack: 1000 }],
      dealer: 0,
      smallBlind: 5,
      bigBlind: 10,
      rng,
    });
    const aces = { ...deal, players: deal.players.map((p, i) => (i === 0 ? { ...p, hole: ['As', 'Ah'] } : p)) };
    const a = chooseBotAction(aces, 'b0', rng);
    if (a.type === 'raise' || a.type === 'allin') strong++;

    const shoved = applyAction(deal, 'b0', { type: 'allin' });
    const trash = { ...shoved, players: shoved.players.map((p, i) => (i === 1 ? { ...p, hole: ['7c', '2d'] } : p)) };
    if (chooseBotAction(trash, 'b1', rng).type === 'fold') folds++;
  }
  assert.ok(strong >= 25, `relances avec AA : ${strong}/30`);
  assert.ok(folds >= 25, `couchés avec 72 face au tapis : ${folds}/30`);
});

test('nom de robot : le premier libre', () => {
  assert.equal(botName([]), 'Robby');
  assert.equal(botName(['robby', 'Simon']), 'Bip');
});
