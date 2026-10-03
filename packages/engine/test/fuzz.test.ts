import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Action, applyAction, legalActions, startHand } from '../src/game.ts';

test('2000 mains aléatoires : jetons conservés, la main se termine toujours', () => {
  for (let h = 0; h < 2000; h++) {
    const n = 2 + (h % 7);
    const stacks = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 200));
    const before = stacks.reduce((a, b) => a + b, 0);
    let s = startHand({
      seats: stacks.map((stack, i) => ({ id: `p${i}`, name: `J${i}`, stack })),
      dealer: h,
      smallBlind: 1,
      bigBlind: 2,
    });
    for (let steps = 0; s.street !== 'finished'; steps++) {
      assert.ok(steps < 500, 'la main ne se termine pas');
      const id = s.players[s.toAct].id;
      const l = legalActions(s, id)!;
      const options: Action[] = [];
      if (l.fold) options.push({ type: 'fold' });
      if (l.check) options.push({ type: 'check' });
      if (l.call) options.push({ type: 'call' });
      if (l.raise) {
        options.push({ type: 'raise', to: l.raise.min }, { type: 'allin' });
        options.push({ type: 'raise', to: l.raise.min + Math.floor(Math.random() * (l.raise.max - l.raise.min + 1)) });
      }
      s = applyAction(s, id, options[Math.floor(Math.random() * options.length)]);
    }
    assert.equal(s.players.reduce((a, p) => a + p.stack, 0), before);
    assert.ok(s.players.every((p) => p.stack >= 0));
  }
});
