import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type RamiState,
  RAMI_NOT_OPENED_PENALTY,
  ramiAddToMeld,
  ramiApply,
  ramiBotMove,
  ramiHandPenalty,
  ramiLayout,
  ramiMeldPoints,
  ramiNewDeck,
  ramiNewGame,
  ramiNextRound,
  ramiRanking,
  ramiSortHand,
  ramiSwapJoker,
} from '../src/rami.ts';
import type { Card } from '../src/cards.ts';

function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `J${i}`, bot: i > 0 }));

/** A game in the play phase where player 0 holds `hand`. */
function position(hand: Card[], extra: Partial<RamiState> = {}): RamiState {
  const g = ramiNewGame({ players: players(2), dealer: 1, rng: seeded(3) });
  const used = new Set(hand);
  return {
    ...g,
    hands: [hand, g.hands[1].filter((c) => !used.has(c))],
    stock: g.stock.filter((c) => !used.has(c)),
    current: 0,
    phase: 'play',
    ...extra,
  };
}

test('le paquet a 108 cartes dont 4 jokers', () => {
  const deck = ramiNewDeck();
  assert.equal(deck.length, 108);
  assert.equal(new Set(deck).size, 108);
  assert.equal(deck.filter((c) => c[0] === 'X').length, 4);
});

test('la donne : 13 cartes chacun, 14 pour le premier joueur qui commence par défausser', () => {
  const g = ramiNewGame({ players: players(4), dealer: 2, rng: seeded(1) });
  assert.equal(g.current, 3);
  assert.equal(g.phase, 'play');
  assert.deepEqual(
    g.hands.map((h) => h.length),
    [13, 13, 13, 14],
  );
  assert.equal(g.stock.length, 108 - 53);
  assert.equal(g.discard.length, 0);
});

test('les brelans et carrés : même valeur, couleurs toutes différentes', () => {
  assert.equal(ramiLayout(['7h1', '7s1', '7d2'])?.kind, 'set');
  assert.equal(ramiLayout(['7h1', '7s1', '7d2', '7c1'])?.kind, 'set');
  assert.equal(ramiLayout(['7h1', '7h2', '7d2']), null, 'deux fois le 7 de cœur');
  assert.equal(ramiLayout(['7h1', '7s1']), null, 'trop court');
  assert.equal(ramiLayout(['7h1', '7s1', '7d1', '7c1', 'Xr1']), null, 'pas de quinte');
  assert.equal(ramiMeldPoints(ramiLayout(['Kh1', 'Ks1', 'Kd2'])!), 30);
  assert.equal(ramiMeldPoints(ramiLayout(['Ah1', 'As1', 'Ad2'])!), 33);
});

test('les suites : même couleur, à la suite, l’as en bas ou en haut mais pas les deux', () => {
  assert.equal(ramiLayout(['5h1', '6h1', '7h2'])?.kind, 'run');
  assert.equal(ramiLayout(['5h1', '6h1', '8h2']), null);
  assert.equal(ramiLayout(['5h1', '6s1', '7h2']), null);
  const low = ramiLayout(['3d1', 'Ad1', '2d2'])!;
  assert.deepEqual(low.cards, ['Ad1', '2d2', '3d1']);
  assert.equal(ramiMeldPoints(low), 6);
  const high = ramiLayout(['Ad1', 'Kd2', 'Qd1'])!;
  assert.deepEqual(high.cards, ['Qd1', 'Kd2', 'Ad1']);
  assert.equal(ramiMeldPoints(high), 31);
  assert.equal(ramiLayout(['Kd1', 'Ad1', '2d1']), null, 'pas de tour du chapeau');
});

test('le joker : un seul par combinaison, il prend la place d’une carte précise', () => {
  const gap = ramiLayout(['5h1', 'Xr1', '7h2'])!;
  assert.deepEqual(gap.faces, ['5h', '6h', '7h']);
  const end = ramiLayout(['5h1', '6h1', 'Xb1'])!;
  assert.deepEqual(end.faces, ['5h', '6h', '7h']);
  const top = ramiLayout(['Qs1', 'Ks1', 'Xb1'])!;
  assert.deepEqual(top.faces, ['Qs', 'Ks', 'As']);
  assert.equal(ramiMeldPoints(top), 31);
  const set = ramiLayout(['9s1', 'Xb1', '9h1'])!;
  assert.equal(set.kind, 'set');
  assert.equal(ramiMeldPoints(set), 27);
  assert.equal(ramiLayout(['9s1', 'Xb1', 'Xr1']), null, 'deux jokers');
});

test('compléter une combinaison et récupérer un joker', () => {
  const run = { ...ramiLayout(['5h1', '6h1', '7h1'])!, id: 1, owner: 0 };
  assert.deepEqual(ramiAddToMeld(run, ['8h1', '4h2'])?.cards, ['4h2', '5h1', '6h1', '7h1', '8h1']);
  assert.deepEqual(ramiAddToMeld(run, ['9h1', '8h1'])?.faces, ['5h', '6h', '7h', '8h', '9h']);
  assert.equal(ramiAddToMeld(run, ['9h1']), null);
  assert.equal(ramiAddToMeld(run, ['8s1']), null);
  const kings = { ...ramiLayout(['Jh1', 'Qh1', 'Kh1'])!, id: 2, owner: 0 };
  assert.deepEqual(ramiAddToMeld(kings, ['Ah2'])?.faces, ['Jh', 'Qh', 'Kh', 'Ah']);

  const withJoker = { ...ramiLayout(['5h1', 'Xr1', '7h2'])!, id: 3, owner: 0 };
  assert.equal(ramiSwapJoker(withJoker, '6s1'), null);
  const swapped = ramiSwapJoker(withJoker, '6h2')!;
  assert.equal(swapped.joker, 'Xr1');
  assert.deepEqual(swapped.meld.cards, ['5h1', '6h2', '7h2']);

  const set = { ...ramiLayout(['9s1', 'Xb1', '9h1'])!, id: 4, owner: 0 };
  assert.equal(ramiSwapJoker(set, '9s2'), null, 'le 9 de pique est déjà là');
  assert.equal(ramiSwapJoker(set, '9d1')?.joker, 'Xb1');
  assert.equal(ramiAddToMeld(set, ['9c1'])?.cards.length, 4);
  assert.equal(ramiAddToMeld(set, ['Xr1']), null, 'un seul joker');
});

test('pour ouvrir il faut 51 points, ensuite on pose librement', () => {
  const hand = ['Kh1', 'Ks1', 'Kd1', '7c1', '8c1', '9c1', '2h1', '2s1', '2d1', '9h1'];
  const g = position(hand);
  assert.throws(() => ramiApply(g, { type: 'meld', melds: [['7c1', '8c1', '9c1']] }), /51 points/);
  assert.throws(() => ramiApply(g, { type: 'add', meld: 1, cards: ['9h1'] }), /Ouvre/);
  const open = ramiApply(g, {
    type: 'meld',
    melds: [
      ['Kh1', 'Ks1', 'Kd1'],
      ['7c1', '8c1', '9c1'],
    ],
  });
  assert.equal(open.opened[0], true);
  assert.equal(open.melds.length, 2);
  assert.equal(open.last?.points, 54);
  const more = ramiApply(open, { type: 'meld', melds: [['2h1', '2s1', '2d1']] });
  assert.equal(more.melds.length, 3);
});

test('on ne rejette pas la carte prise dans la défausse, et le premier à vider sa main gagne', () => {
  let g = position(['Kh1', 'Ks1', 'Kd1', 'Qh1', 'Qs1', 'Qd1', '4c1'], {
    phase: 'draw',
    discard: ['9d1'],
  });
  g = ramiApply(g, { type: 'take' });
  assert.equal(g.taken, '9d1');
  assert.throws(() => ramiApply(g, { type: 'discard', card: '9d1' }), /viens de prendre/);
  g = ramiApply(g, {
    type: 'meld',
    melds: [
      ['Kh1', 'Ks1', 'Kd1'],
      ['Qh1', 'Qs1', 'Qd1'],
    ],
  });
  assert.equal(g.openedThisTurn, true);
  g = ramiApply(g, { type: 'discard', card: '4c1' });
  assert.equal(g.phase, 'draw');
  assert.equal(g.current, 1);
  assert.equal(g.discard[g.discard.length - 1], '4c1');
});

test('fin de manche : pénalités, 100 points pour qui n’a pas ouvert, doublées pour un rami sec', () => {
  const g = position(['Kh1', 'Ks1', 'Kd1', 'Qh1', 'Qs1', 'Qd1', '4c1'], { target: 1000 });
  const end = ramiApply(
    g,
    {
      type: 'meld',
      melds: [
        ['Kh1', 'Ks1', 'Kd1'],
        ['Qh1', 'Qs1', 'Qd1'],
      ],
    },
    seeded(2),
  );
  const out = ramiApply(end, { type: 'discard', card: '4c1' });
  assert.equal(out.phase, 'roundOver');
  assert.equal(out.result?.winner, 0);
  assert.equal(out.result?.sec, true);
  assert.deepEqual(out.result?.penalties, [0, RAMI_NOT_OPENED_PENALTY * 2]);

  const opened = position(['5h1', '6h1', '7h1', '8h1'], {
    opened: [true, true],
    hands: [
      ['5h1', '6h1', '7h1', '8h1'],
      ['Ah1', 'Xr1', '3c1'],
    ],
  });
  const done = ramiApply(opened, { type: 'meld', melds: [['5h1', '6h1', '7h1']] });
  const last = ramiApply(done, { type: 'discard', card: '8h1' });
  assert.equal(last.result?.sec, false);
  assert.deepEqual(last.result?.penalties, [0, 11 + 20 + 3]);
  assert.equal(ramiHandPenalty(['Ah1', 'Xr1', '3c1', 'Kd1']), 44);
});

test('la partie s’arrête au score visé, le plus petit score gagne', () => {
  const g = position(['Kh1', 'Ks1', 'Kd1', 'Qh1', 'Qs1', 'Qd1', '4c1'], { target: 150, scores: [40, 0] });
  const end = ramiApply(
    ramiApply(g, {
      type: 'meld',
      melds: [
        ['Kh1', 'Ks1', 'Kd1'],
        ['Qh1', 'Qs1', 'Qd1'],
      ],
    }),
    { type: 'discard', card: '4c1' },
  );
  assert.equal(end.phase, 'gameOver');
  assert.deepEqual(end.scores, [40, 200]);
  assert.deepEqual(
    ramiRanking(end).map((r) => [r.player, r.place]),
    [
      [0, 1],
      [1, 2],
    ],
  );
  assert.throws(() => ramiNextRound(end), /pas finie/);
});

test('la pioche vide se refait avec la défausse', () => {
  const g = position(['Kh1', '4c1'], { phase: 'draw', stock: [], discard: ['2c1', '3c1', '9s2'] });
  const next = ramiApply(g, { type: 'draw' }, seeded(5));
  assert.equal(next.hands[0].length, 3);
  assert.deepEqual(next.discard, ['9s2']);
  assert.equal(next.stock.length, 1);
  assert.equal(next.last?.type, 'reshuffle');
});

test('trier la main par couleur ou par valeur', () => {
  const hand = ['Xr1', '5h1', 'Ks1', '5s1', 'Ah2'];
  assert.deepEqual(ramiSortHand(hand, 'suit'), ['5s1', 'Ks1', '5h1', 'Ah2', 'Xr1']);
  assert.deepEqual(ramiSortHand(hand, 'rank'), ['5s1', '5h1', 'Ks1', 'Ah2', 'Xr1']);
});

test('le robot ouvre dès qu’il a 51 points et prend une défausse utile', () => {
  const g = position(['Kh1', 'Ks1', 'Kd1', 'Qh1', 'Qs1', 'Qd1', '4c1', '9d1']);
  const move = ramiBotMove(g);
  assert.equal(move.type, 'meld');
  if (move.type === 'meld') assert.equal(move.melds.length, 2);

  const small = position(['5h1', '6h1', '2c1', '9s1'], { phase: 'draw', discard: ['7h2'] });
  assert.deepEqual(ramiBotMove({ ...small, opened: [true, false] }), { type: 'take' });
  assert.deepEqual(ramiBotMove({ ...small, discard: ['Jd1'], opened: [true, false] }), { type: 'draw' });
});

test('le robot garde ses paires et jette la carte isolée la plus chère', () => {
  const g = position(['5h1', '5s1', '8c1', '9c1', 'Kd1', '2s1'], { opened: [true, false] });
  const move = ramiBotMove(g);
  assert.deepEqual(move, { type: 'discard', card: 'Kd1' });
});

test('des parties entières entre robots se terminent sans erreur', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rng = seeded(seed);
    const n = 2 + (seed % 3);
    let g = ramiNewGame({ players: players(n).map((p) => ({ ...p, bot: true })), target: 150, rng });
    let steps = 0;
    let rounds = 0;
    let wins = 0;
    while (g.phase !== 'gameOver') {
      if (g.phase === 'roundOver') {
        rounds++;
        if (g.result?.winner !== null) wins++;
        g = ramiNextRound(g, rng);
        continue;
      }
      const before = g.hands.reduce((s, h) => s + h.length, 0) + g.stock.length + g.discard.length;
      const onTable = g.melds.reduce((s, m) => s + m.cards.length, 0);
      g = ramiApply(g, ramiBotMove(g), rng);
      const after =
        g.hands.reduce((s, h) => s + h.length, 0) +
        g.stock.length +
        g.discard.length +
        g.melds.reduce((s, m) => s + m.cards.length, 0);
      assert.equal(after, before + onTable, 'aucune carte ne se perd');
      for (const m of g.melds) assert.ok(ramiLayout(m.cards), `combinaison invalide ${m.cards}`);
      assert.ok(++steps < 50000, 'la partie ne finit pas');
    }
    rounds++;
    if (g.result?.winner !== null) wins++;
    assert.ok(Math.max(...g.scores) >= 150);
    // Robots should finish most rounds rather than block them.
    assert.ok(wins >= rounds / 2, `seulement ${wins} manches gagnées sur ${rounds}`);
  }
});
