import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, startHand } from '../src/game.ts';
import { handOutcomes } from '../src/stats.ts';

const seats = (...stacks: number[]) => stacks.map((stack, i) => ({ id: `p${i}`, name: `J${i}`, stack }));

test('tout le monde se couche : la grosse blinde gagne les blindes', () => {
  let s = startHand({ seats: seats(100, 100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  s = applyAction(s, 'p0', { type: 'fold' });
  s = applyAction(s, 'p1', { type: 'fold' });
  assert.deepEqual(handOutcomes(s), [
    { id: 'p0', net: 0, won: false, bestPot: 0 },
    { id: 'p1', net: -1, won: false, bestPot: 0 },
    { id: 'p2', net: 1, won: true, bestPot: 3 },
  ]);
});

test('les gains et pertes s’équilibrent après un tapis', () => {
  for (let k = 0; k < 50; k++) {
    let s = startHand({ seats: seats(50, 120, 80), dealer: k % 3, smallBlind: 5, bigBlind: 10 });
    while (s.street !== 'finished') s = applyAction(s, s.players[s.toAct].id, { type: 'allin' });
    const outcomes = handOutcomes(s);
    assert.equal(outcomes.reduce((a, o) => a + o.net, 0), 0);
    for (const o of outcomes) {
      const p = s.players.find((x) => x.id === o.id)!;
      assert.equal(o.net, p.stack - p.startStack!);
      assert.equal(o.won, o.bestPot > 0);
    }
  }
});

test('refuse une main pas finie', () => {
  const s = startHand({ seats: seats(100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  assert.throws(() => handOutcomes(s));
});
