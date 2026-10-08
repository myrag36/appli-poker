import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type UnoState,
  type UnoVariant,
  UNO_HAND_SIZE,
  unoApply,
  unoBotCatches,
  unoBotMove,
  unoCanCatch,
  unoCanPlay,
  unoCanSay,
  unoCardPoints,
  unoDeck,
  unoKind,
  unoLegalCards,
  unoNewGame,
  unoNextRound,
  unoSort,
  unoStandings,
} from '../src/uno.ts';

function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Joueur ${i}` }));

/** A round in progress with chosen hands and top card; player 0 to play. */
function make(variant: UnoVariant, hands: string[][], top: string, extra: Partial<UnoState> = {}): UnoState {
  const base = unoNewGame(variant, names(hands.length), 0, seeded(1));
  const used = new Set([...hands.flat(), top]);
  return {
    ...base,
    players: base.players.map((p, i) => ({ ...p, hand: hands[i] })),
    deck: base.deck.concat(base.discard, ...base.players.map((p) => p.hand)).filter((c) => !used.has(c)),
    discard: [top],
    color: variant === 'uno' ? top[0] : top[1],
    current: 0,
    ...extra,
  };
}

const play = (card: string, color?: string, say?: boolean) => ({ type: 'play' as const, card, color, say });
const draw = { type: 'draw' as const };

const total = (s: UnoState) =>
  s.deck.length + s.discard.length + s.players.reduce((n, p) => n + p.hand.length, 0);

test('le paquet de Uno a 108 cartes toutes différentes', () => {
  const deck = unoDeck();
  assert.equal(deck.length, 108);
  assert.equal(new Set(deck).size, 108);
  assert.equal(deck.filter((c) => unoKind('uno', c) === 'wild4').length, 4);
  assert.equal(deck.filter((c) => unoKind('uno', c) === 'wild').length, 4);
  assert.equal(deck.filter((c) => unoKind('uno', c) === 'draw2').length, 8);
  assert.equal(deck.filter((c) => c[1] === '0').length, 4);
  assert.equal(deck.filter((c) => c.startsWith('r7')).length, 2);
});

test('la donne : 7 cartes chacun et une carte simple retournée', () => {
  for (const variant of ['uno', 'huit'] as const) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = unoNewGame(variant, names(4), 0, seeded(seed));
      for (const p of s.players) assert.equal(p.hand.length, UNO_HAND_SIZE);
      assert.equal(s.discard.length, 1);
      assert.equal(unoKind(variant, s.discard[0]), 'number');
      assert.equal(total(s), variant === 'uno' ? 108 : 52);
      assert.equal(s.current, (s.dealer + 1) % 4);
    }
  }
});

test('valeur des cartes et tri de la main', () => {
  assert.equal(unoCardPoints('uno', 'r7a'), 7);
  assert.equal(unoCardPoints('uno', 'gSa'), 20);
  assert.equal(unoCardPoints('uno', 'wFa'), 50);
  assert.equal(unoCardPoints('huit', '8h'), 50);
  assert.equal(unoCardPoints('huit', 'Js'), 20);
  assert.equal(unoCardPoints('huit', 'Kd'), 10);
  assert.equal(unoCardPoints('huit', '5c'), 5);
  assert.deepEqual(unoSort('uno', ['wWa', 'b2a', 'r9a', 'r1b', 'r1a']), ['r1a', 'r1b', 'r9a', 'b2a', 'wWa']);
  assert.deepEqual(unoSort('huit', ['8s', 'Kh', '3h', 'As']), ['As', '3h', 'Kh', '8s']);
});

test('Uno : couleur ou symbole, Joker partout, +4 seulement sans la couleur', () => {
  const s = make('uno', [['r5a', 'b7a', 'g2a', 'wWa', 'wFa'], ['y1a']], 'r7a');
  assert.ok(unoCanPlay(s, 0, 'r5a'));
  assert.ok(unoCanPlay(s, 0, 'b7a'));
  assert.ok(!unoCanPlay(s, 0, 'g2a'));
  assert.ok(unoCanPlay(s, 0, 'wWa'));
  assert.ok(!unoCanPlay(s, 0, 'wFa'), 'a red card is in hand');
  assert.ok(!unoCanPlay(s, 1, 'y1a'), 'not their turn');
  const noRed = make('uno', [['b7a', 'wFa'], ['y1a']], 'r7a');
  assert.ok(unoCanPlay(noRed, 0, 'wFa'));
  assert.throws(() => unoApply(s, 0, play('wWa')), /couleur/);
  const after = unoApply(s, 0, play('wWa', 'g'));
  assert.equal(after.color, 'g');
  assert.equal(after.current, 1);
  assert.ok(unoCanPlay({ ...after, current: 0 }, 0, 'g2a'));
});

test('Uno : Passe, Inverse, +2 et +4', () => {
  const hands = [
    ['rSa', 'rRa', 'rDa', 'b1a'],
    ['y1a', 'y2a'],
    ['g1a', 'g2a'],
    ['b2a', 'b3a'],
  ];
  const s = make('uno', hands, 'r7a');
  assert.equal(unoApply(s, 0, play('rSa')).current, 2);
  const rev = unoApply(s, 0, play('rRa'));
  assert.equal(rev.direction, -1);
  assert.equal(rev.current, 3);
  const plus = unoApply(s, 0, play('rDa'));
  assert.equal(plus.players[1].hand.length, 4);
  assert.equal(plus.current, 2);
  assert.deepEqual(plus.last, {
    type: 'play',
    player: 0,
    card: 'rDa',
    color: undefined,
    penalty: { player: 1, count: 2 },
  });
  const four = unoApply(make('uno', [['wFa', 'b1a'], ['y1a'], ['g1a']], 'r7a'), 0, play('wFa', 'b'));
  assert.equal(four.players[1].hand.length, 5);
  assert.equal(four.current, 2);
  assert.equal(four.color, 'b');
  // Two players: a reverse or a skip lets the same player go again.
  const duo = make('uno', [['rRa', 'rSa', 'b1a'], ['y1a']], 'r7a');
  assert.equal(unoApply(duo, 0, play('rRa')).current, 0);
  assert.equal(unoApply(duo, 0, play('rSa')).current, 0);
});

test('8 américain : le 8 change la couleur, le Valet saute, l’As inverse', () => {
  const s = make(
    'huit',
    [
      ['8c', 'Jh', 'Ah', '5s', '9d'],
      ['3c', '4c'],
      ['3d', '4d'],
    ],
    '9h',
  );
  assert.ok(unoCanPlay(s, 0, '8c'));
  assert.ok(unoCanPlay(s, 0, 'Jh'));
  assert.ok(unoCanPlay(s, 0, '9d'));
  assert.ok(!unoCanPlay(s, 0, '5s'));
  const eight = unoApply(s, 0, play('8c', 's'));
  assert.equal(eight.color, 's');
  assert.ok(unoCanPlay({ ...eight, current: 0 }, 0, '5s'));
  assert.equal(unoApply(s, 0, play('Jh')).current, 2);
  const ace = unoApply(s, 0, play('Ah'));
  assert.equal(ace.direction, -1);
  assert.equal(ace.current, 2);
});

test('8 américain : les 2 se cumulent', () => {
  const s = make(
    'huit',
    [
      ['2h', '5s', '6s'],
      ['2c', '9h', '8h'],
      ['3d', '4d', '5d'],
    ],
    '9h',
  );
  const a = unoApply(s, 0, play('2h'));
  assert.equal(a.pendingDraw, 2);
  assert.equal(a.current, 1);
  // Only a 2 answers a 2, not even an 8.
  assert.deepEqual(unoLegalCards(a, 1), ['2c']);
  const b = unoApply(a, 1, play('2c'));
  assert.equal(b.pendingDraw, 4);
  assert.equal(b.current, 2);
  const c = unoApply(b, 2, draw);
  assert.equal(c.players[2].hand.length, 7);
  assert.equal(c.pendingDraw, 0);
  assert.equal(c.current, 0);
  assert.equal(c.drawn, null);
});

test('piocher : on peut jouer la carte piochée, sinon le tour passe', () => {
  const base = make('uno', [['b1a', 'b2a'], ['y1a']], 'r7a');
  // A playable card on top of the pile.
  const fit = unoApply({ ...base, deck: [...base.deck.filter((c) => c !== 'r3a'), 'r3a'] }, 0, draw);
  assert.equal(fit.drawn, 'r3a');
  assert.equal(fit.current, 0);
  assert.deepEqual(unoLegalCards(fit, 0), ['r3a']);
  assert.ok(!unoCanPlay(fit, 0, 'b1a'));
  assert.throws(() => unoApply(fit, 0, draw));
  assert.equal(unoApply(fit, 0, { type: 'pass' }).current, 1);
  assert.equal(unoApply(fit, 0, play('r3a')).current, 1);
  // A card that does not fit: the turn goes on.
  const miss = unoApply({ ...base, deck: [...base.deck.filter((c) => c !== 'g3a'), 'g3a'] }, 0, draw);
  assert.equal(miss.drawn, null);
  assert.equal(miss.current, 1);
  assert.ok(miss.players[0].hand.includes('g3a'));
  assert.throws(() => unoApply(base, 0, { type: 'pass' }));
});

test('la pioche vide : on retourne la défausse', () => {
  const s = make('uno', [['b1a'], ['y1a']], 'r7a', { deck: [], discard: ['g3a', 'g4a', 'r7a'] });
  const next = unoApply(s, 0, draw, seeded(3));
  assert.equal(next.discard.length, 1);
  assert.equal(next.discard[0], 'r7a');
  assert.equal(next.players[0].hand.length + next.deck.length, 3);
});

test('Uno ! oublié : un autre joueur peut le faire piocher 2 cartes', () => {
  const s = make('uno', [['r1a', 'r2a'], ['y1a', 'y2a'], ['g1a']], 'r7a');
  assert.ok(unoCanSay(s, 0));
  assert.ok(!unoCanSay(s, 1));
  // Forgot: exposed until the next player acts.
  const a = unoApply(s, 0, play('r1a'));
  assert.equal(a.exposed, 0);
  assert.ok(unoCanCatch(a, 2, 0));
  assert.ok(!unoCanCatch(a, 0, 0));
  const caught = unoApply(a, 2, { type: 'catch', target: 0 });
  assert.equal(caught.players[0].hand.length, 3);
  assert.equal(caught.exposed, null);
  assert.equal(caught.current, 1);
  // Says it in time.
  const saved = unoApply(a, 0, { type: 'say' });
  assert.equal(saved.exposed, null);
  assert.throws(() => unoApply(saved, 2, { type: 'catch', target: 0 }));
  // Says it with the card.
  assert.equal(unoApply(s, 0, play('r1a', undefined, true)).exposed, null);
  // Says it before playing.
  const before = unoApply(s, 0, { type: 'say' });
  assert.equal(unoApply(before, 0, play('r1a')).exposed, null);
  // Too late once the next player has played.
  const late = unoApply(a, 1, play('y1a', undefined, true));
  assert.equal(late.exposed, null);
  assert.ok(!unoCanCatch(late, 2, 0));
  assert.ok(unoBotCatches(a, () => 0));
  assert.ok(!unoBotCatches(late, () => 0));
});

test('fin de manche : le gagnant marque les cartes des autres', () => {
  const s = make('uno', [['r1a'], ['y9a', 'wWa'], ['gSa', 'g3a']], 'r7a');
  const end = unoApply(s, 0, play('r1a'));
  assert.equal(end.phase, 'gameOver');
  assert.equal(end.roundWinner, 0);
  assert.equal(end.roundPoints, 9 + 50 + 20 + 3);
  assert.equal(end.winner, 0);
  assert.equal(end.players[0].score, 82);
  assert.throws(() => unoApply(end, 1, draw));

  // Playing to a target: rounds go on until someone gets there.
  const long = { ...s, target: 100 };
  const r1 = unoApply(long, 0, play('r1a'));
  assert.equal(r1.phase, 'roundOver');
  assert.equal(r1.winner, null);
  const r2 = unoNextRound(r1, seeded(4));
  assert.equal(r2.round, 2);
  assert.equal(r2.phase, 'playing');
  assert.equal(r2.dealer, (r1.dealer + 1) % 3);
  assert.equal(r2.players[0].score, 82);
  for (const p of r2.players) assert.equal(p.hand.length, 7);
  assert.equal(total(r2), 108);
  assert.deepEqual(
    unoStandings(r1).map((x) => x.index),
    [0, 1, 2],
  );
});

test('les robots jouent juste et gardent leurs jokers', () => {
  const s = make(
    'uno',
    [
      ['r5a', 'wWa', 'b5a', 'b6a', 'b7a'],
      ['y1a', 'y2a', 'y3a', 'y4a'],
    ],
    'r7a',
  );
  const move = unoBotMove(s, 0, seeded(1));
  assert.equal(move.type, 'play');
  assert.notEqual(move.type === 'play' && move.card, 'wWa');
  // Nothing fits: draws.
  assert.deepEqual(unoBotMove(make('uno', [['b1a'], ['y1a']], 'r7a'), 0), { type: 'draw' });
  // A wild asks for the color it holds most.
  const wild = unoBotMove(
    make(
      'uno',
      [
        ['wWa', 'g1a', 'g2a', 'b3a'],
        ['y1a', 'y5a', 'y6a'],
      ],
      'r7a',
    ),
    0,
    seeded(2),
  );
  assert.deepEqual(wild.type === 'play' && [wild.card, wild.color], ['wWa', 'g']);
  // Attacks a neighbour about to win.
  const atk = unoBotMove(make('uno', [['r5a', 'rDa', 'r9a', 'b1a'], ['y1a']], 'r7a'), 0, seeded(3));
  assert.equal(atk.type === 'play' && atk.card, 'rDa');
  // 8 américain: answers a 2 with a 2.
  const huit = make('huit', [['2c', '5h', '6h'], ['3c']], '2h', { pendingDraw: 2 });
  assert.deepEqual(unoBotMove(huit, 0, seeded(1)), {
    type: 'play',
    card: '2c',
    color: undefined,
    say: undefined,
  });
});

for (const variant of ['uno', 'huit'] as const) {
  test(`${variant} : des centaines de parties de robots vont au bout`, () => {
    for (let seed = 1; seed <= 150; seed++) {
      const rng = seeded(seed);
      const n = 2 + (seed % 5);
      let s = unoNewGame(variant, names(n), seed % 3 === 0 ? 0 : variant === 'uno' ? 200 : 100, rng);
      const size = variant === 'uno' ? 108 : 52;
      let moves = 0;
      while (s.phase !== 'gameOver') {
        if (s.phase === 'roundOver') {
          s = unoNextRound(s, rng);
          continue;
        }
        if (s.exposed !== null && unoBotCatches(s, rng)) {
          const by = (s.exposed + 1) % n;
          s = unoApply(s, by, { type: 'catch', target: s.exposed }, rng);
        }
        const move = unoBotMove(s, s.current, rng);
        if (move.type === 'play') assert.ok(unoCanPlay(s, s.current, move.card));
        s = unoApply(s, s.current, move, rng);
        assert.equal(total(s), size);
        const all = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.hand)];
        assert.equal(new Set(all).size, size);
        assert.ok(++moves < 20000, 'game too long');
      }
      assert.ok(s.winner !== null);
      assert.ok(s.target === 0 || s.players[s.winner].score >= s.target);
      assert.equal(unoStandings(s)[0].index, s.winner);
    }
  });
}
