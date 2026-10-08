import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type TarotPlayedCard,
  type TarotState,
  TAROT_EXCUSE,
  tarotApply,
  tarotBotEcart,
  tarotBotMove,
  tarotCountPoints,
  tarotEcartError,
  tarotIsTrump,
  tarotLegalCards,
  tarotLegalMoves,
  tarotNewDeck,
  tarotNewGame,
  tarotNextDeal,
  tarotPetitSec,
  tarotPoints,
  tarotScore,
  tarotStartDeal,
  tarotTrickWinnerIndex,
  tarotWantedContract,
} from '../src/tarot.ts';
import type { Card } from '../src/cards.ts';

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

const t = (player: number, card: Card): TarotPlayedCard => ({ player, card });

/** Builds the deck that deals exactly these hands and chien (dealer 3, so seat 0 is served first). */
function rig(hands: Card[][], chien: Card[], dealer = 3): Card[] {
  const deck: Card[] = [];
  const offsets = [0, 0, 0, 0];
  for (let round = 0; round < 6; round++) {
    for (let i = 1; i <= 4; i++) {
      const p = (dealer + i) % 4;
      deck.push(...hands[p].slice(offsets[p], offsets[p] + 3));
      offsets[p] += 3;
    }
    deck.push(chien[round]);
  }
  return deck;
}

/** A deal in play with the given hands (18 cards each is not required). */
function playing(hands: Card[][], taker = 0, dealer = 3): TarotState {
  const s = tarotStartDeal({ dealer, rng: seeded(1) });
  return {
    ...s,
    phase: 'playing',
    hands,
    contract: 'garde',
    taker,
    toAct: (dealer + 1) % 4,
    result: null,
  };
}

test('le paquet : 78 cartes, 91 points, 3 bouts', () => {
  const deck = tarotNewDeck();
  assert.equal(deck.length, 78);
  assert.equal(new Set(deck).size, 78);
  assert.equal(tarotCountPoints(deck), 91);
  assert.equal(deck.filter(tarotIsTrump).length, 21);
  assert.equal(tarotPoints('Rh'), 4.5);
  assert.equal(tarotPoints('Dh'), 3.5);
  assert.equal(tarotPoints('Ch'), 2.5);
  assert.equal(tarotPoints('Vh'), 1.5);
  assert.equal(tarotPoints('10h'), 0.5);
  assert.equal(tarotPoints('1t'), 4.5);
  assert.equal(tarotPoints('21t'), 4.5);
  assert.equal(tarotPoints('EX'), 4.5);
  assert.equal(tarotPoints('12t'), 0.5);
});

test('distribution : 18 cartes chacun et 6 au chien', () => {
  const s = tarotStartDeal({ dealer: 1, rng: seeded(4) });
  if (s.phase === 'bidding') {
    for (const h of s.hands) assert.equal(h.length, 18);
    assert.equal(s.chien.length, 6);
    assert.equal(new Set([...s.hands.flat(), ...s.chien]).size, 78);
    assert.equal(s.toAct, 2, 'la parole commence après le donneur');
  }
});

test('petit sec : la donne est annulée', () => {
  assert.equal(tarotPetitSec(['1t', 'Rh', '2s']), true);
  assert.equal(tarotPetitSec(['1t', 'EX', '2s']), false);
  assert.equal(tarotPetitSec(['1t', '5t', '2s']), false);
  const deck = tarotNewDeck();
  // Seat 0 gets the Petit and 17 suit cards.
  const plain = deck.filter((c) => !tarotIsTrump(c) && c !== 'EX');
  const trumps = deck.filter((c) => tarotIsTrump(c) && c !== '1t');
  const hands = [
    ['1t', ...plain.slice(0, 17)],
    [...plain.slice(17, 35)],
    [...plain.slice(35, 53)],
    [...plain.slice(53, 56), ...trumps.slice(0, 15)],
  ];
  const chien = [...trumps.slice(15), 'EX'];
  const s = tarotStartDeal({ dealer: 3, deck: rig(hands, chien) });
  assert.equal(s.phase, 'dealOver');
  assert.deepEqual(s.result, { kind: 'redeal', reason: 'petitSec', player: 0 });
  const next = tarotNextDeal(s, seeded(2));
  assert.equal(next.dealNumber, 1, 'une donne annulée ne compte pas');
  assert.equal(next.dealer, 0);
});

test('enchères : il faut monter, tout le monde passe = on redistribue', () => {
  let s = tarotStartDeal({ dealer: 3, rng: seeded(11) });
  assert.equal(s.phase, 'bidding');
  assert.equal(tarotLegalMoves(s).length, 5);
  assert.throws(() => tarotApply(s, 1, { type: 'bid', bid: 'pass' }), /pas ton tour/);
  s = tarotApply(s, 0, { type: 'bid', bid: 'garde' });
  assert.deepEqual(
    tarotLegalMoves(s).map((m) => (m.type === 'bid' ? m.bid : '')),
    ['pass', 'gardeSans', 'gardeContre'],
  );
  assert.throws(() => tarotApply(s, 1, { type: 'bid', bid: 'petite' }), /plus haut/);
  assert.throws(() => tarotApply(s, 1, { type: 'bid', bid: 'garde' }), /plus haut/);
  s = tarotApply(s, 1, { type: 'bid', bid: 'pass' });
  s = tarotApply(s, 2, { type: 'bid', bid: 'pass' });
  s = tarotApply(s, 3, { type: 'bid', bid: 'pass' });
  assert.equal(s.phase, 'ecart');
  assert.equal(s.taker, 0);
  assert.equal(s.contract, 'garde');
  assert.equal(s.hands[0].length, 24, 'le preneur ramasse le chien');
  assert.equal(s.toAct, 0);

  let p = tarotStartDeal({ dealer: 3, rng: seeded(11) });
  for (const seat of [0, 1, 2, 3]) p = tarotApply(p, seat, { type: 'bid', bid: 'pass' });
  assert.equal(p.phase, 'dealOver');
  assert.deepEqual(p.result, { kind: 'redeal', reason: 'allPass' });
  assert.equal(tarotNextDeal(p, seeded(1)).dealNumber, 1);
});

test('garde sans et garde contre : le chien reste caché', () => {
  let s = tarotStartDeal({ dealer: 3, rng: seeded(11) });
  s = tarotApply(s, 0, { type: 'bid', bid: 'pass' });
  s = tarotApply(s, 1, { type: 'bid', bid: 'gardeSans' });
  s = tarotApply(s, 2, { type: 'bid', bid: 'pass' });
  const sans = tarotApply(s, 3, { type: 'bid', bid: 'pass' });
  assert.equal(sans.phase, 'playing');
  assert.equal(sans.taker, 1);
  assert.equal(sans.hands[1].length, 18);
  assert.deepEqual(sans.won[0], sans.chien, 'le chien compte pour le preneur');
  const contre = tarotApply(s, 3, { type: 'bid', bid: 'gardeContre' });
  assert.equal(contre.taker, 3);
  assert.deepEqual(contre.won[1], contre.chien, 'le chien va à la défense');
  assert.equal(contre.toAct, 0, 'le joueur après le donneur entame');
});

test('écart : ni roi, ni bout, ni atout sauf obligation', () => {
  const hand = [
    'Rs',
    'Ds',
    '2s',
    '3s',
    '4s',
    'Rh',
    '5h',
    '6h',
    '1t',
    '21t',
    'EX',
    '7t',
    '8t',
    '9t',
    '10t',
    '11t',
    '12t',
    '13t',
    '14t',
    '15t',
    '16t',
    '17t',
    '18t',
    '19t',
  ];
  assert.equal(tarotEcartError(hand, ['Ds', '2s', '3s', '4s', '5h', '6h']), null);
  assert.match(tarotEcartError(hand, ['Rs', '2s', '3s', '4s', '5h', '6h'])!, /roi/);
  assert.match(tarotEcartError(hand, ['EX', '2s', '3s', '4s', '5h', '6h'])!, /bout/);
  assert.match(tarotEcartError(hand, ['7t', '2s', '3s', '4s', '5h', '6h'])!, /atout/);
  assert.match(tarotEcartError(hand, ['2s', '3s', '4s', '5h', '6h'])!, /6 cartes/);
  // Only 5 cards other than kings and trumps: one trump must go, with all of them.
  const short = hand.filter((c) => c !== 'Ds');
  short.push('20t');
  assert.equal(tarotEcartError(short, ['2s', '3s', '4s', '5h', '6h', '7t']), null);
  assert.match(tarotEcartError(short, ['2s', '3s', '4s', '5h', '7t', '8t'])!, /autres cartes/);
  const bot = tarotBotEcart(hand);
  assert.equal(tarotEcartError(hand, bot), null);
  assert.ok(bot.includes('Ds'), 'la dame seule part au chien');
});

test('le preneur fait son écart, puis le jeu commence', () => {
  let s = tarotStartDeal({ dealer: 3, rng: seeded(11) });
  s = tarotApply(s, 0, { type: 'bid', bid: 'petite' });
  for (const p of [1, 2, 3]) s = tarotApply(s, p, { type: 'bid', bid: 'pass' });
  assert.throws(() => tarotApply(s, 0, { type: 'play', card: s.hands[0][0] }), /écart/);
  const ecart = tarotBotEcart(s.hands[0]);
  s = tarotApply(s, 0, { type: 'ecart', cards: ecart });
  assert.equal(s.phase, 'playing');
  assert.equal(s.hands[0].length, 18);
  assert.deepEqual(s.won[0], ecart);
  assert.ok(ecart.every((c) => !s.hands[0].includes(c)));
});

test('pli : l’atout le plus fort, sinon la plus forte de la couleur ; l’Excuse ne gagne pas', () => {
  assert.equal(tarotTrickWinnerIndex([t(0, '5h'), t(1, 'Rh'), t(2, '2t'), t(3, 'Dh')]), 2);
  assert.equal(tarotTrickWinnerIndex([t(0, '5h'), t(1, 'Rh'), t(2, 'Rs'), t(3, 'Dh')]), 1);
  assert.equal(tarotTrickWinnerIndex([t(0, '3t'), t(1, '21t'), t(2, '20t'), t(3, '1t')]), 1);
  assert.equal(tarotTrickWinnerIndex([t(0, 'EX'), t(1, '2h'), t(2, 'Vh'), t(3, '9s')]), 2);
  assert.equal(tarotTrickWinnerIndex([t(0, 'Ch'), t(1, 'EX'), t(2, 'Vh'), t(3, 'Dh')]), 3);
});

test('règles de jeu : fournir, couper, monter, Excuse toujours permise', () => {
  const hand = ['3h', 'Rh', '5t', '12t', 'EX', '2s'];
  assert.deepEqual(tarotLegalCards(hand, [t(3, '9h')]).sort(), ['3h', 'EX', 'Rh'].sort());
  // No hearts: must trump, and go over the 8.
  const noHearts = ['5t', '12t', 'EX', '2s'];
  assert.deepEqual(tarotLegalCards(noHearts, [t(3, '9h')]).sort(), ['12t', '5t', 'EX'].sort());
  assert.deepEqual(tarotLegalCards(noHearts, [t(2, '9h'), t(3, '8t')]).sort(), ['12t', 'EX'].sort());
  // Cannot go over: any trump ("pisser").
  assert.deepEqual(tarotLegalCards(noHearts, [t(2, '9h'), t(3, '15t')]).sort(), ['12t', '5t', 'EX'].sort());
  // Trump led: go higher, even over a partner.
  assert.deepEqual(tarotLegalCards(hand, [t(3, '7t')]).sort(), ['12t', 'EX'].sort());
  // Neither suit nor trump: anything.
  assert.deepEqual(tarotLegalCards(['2s', 'Rd'], [t(3, '9h')]).sort(), ['2s', 'Rd']);
  // Excuse led: the next card sets the suit.
  assert.deepEqual(tarotLegalCards(hand, [t(3, 'EX')]).sort(), hand.slice().sort());
  assert.deepEqual(tarotLegalCards(hand, [t(2, 'EX'), t(3, '4s')]), ['2s', 'EX']);
});

test('jouer une carte interdite est refusé', () => {
  const s = playing([
    ['3h', '5t'],
    ['Rh', '2s'],
    ['4h', '6t'],
    ['5h', '7t'],
  ]);
  assert.throws(() => tarotApply(s, 0, { type: 'play', card: 'Rh' }), /pas cette carte/);
  const s1 = tarotApply(s, 0, { type: 'play', card: '3h' });
  assert.throws(() => tarotApply(s1, 1, { type: 'play', card: '2s' }), /pas permise/);
});

test('l’Excuse reste à son camp contre une demi-carte, sauf au dernier pli', () => {
  // Seat 1 (defence) plays the Excuse; the taker (0) wins the trick.
  let s = playing([
    ['Rh', '2h'],
    ['EX', '3h'],
    ['4h', '5h'],
    ['6h', '7h'],
  ]);
  s = tarotApply(s, 0, { type: 'play', card: 'Rh' });
  s = tarotApply(s, 1, { type: 'play', card: 'EX' });
  s = tarotApply(s, 2, { type: 'play', card: '4h' });
  s = tarotApply(s, 3, { type: 'play', card: '6h' });
  assert.ok(s.won[1].includes('EX'));
  assert.deepEqual(s.adjust, [0.5, -0.5]);
  assert.equal(tarotCountPoints(s.won[0]) + s.adjust[0], 4.5 + 0.5 + 0.5 + 0.5);
  // The last trick: the Excuse is lost to the winners.
  let e = playing([['Rh'], ['EX'], ['4h'], ['6h']]);
  for (const [p, c] of [
    [0, 'Rh'],
    [1, 'EX'],
    [2, '4h'],
    [3, '6h'],
  ] as const)
    e = tarotApply(e, p, { type: 'play', card: c });
  assert.ok(e.won[0].includes('EX'));
  assert.equal(e.phase, 'dealOver');
});

test('score : 25 + écart, multiplié par le contrat, ×3 pour le preneur', () => {
  // Garde, 2 bouts (41), 49 points: 25 + 8 = 33, ×2 = 66 per defender.
  const r = tarotScore(2, 'garde', 49, 2, null);
  assert.equal(r.target, 41);
  assert.equal(r.made, true);
  assert.equal(r.gap, 8);
  assert.equal(r.perDefender, 66);
  assert.deepEqual(r.dealScores, [-66, -66, 198, -66]);
  // Petite, no oudler (56), 50 points: lost by 6 → -(31).
  const lost = tarotScore(0, 'petite', 50, 0, null);
  assert.equal(lost.made, false);
  assert.deepEqual(lost.dealScores, [-93, 31, 31, 31]);
  // Exactly the target: made by 0.
  assert.equal(tarotScore(0, 'garde', 36, 3, null).perDefender, 50);
  // Garde contre, 1 oudler (51), 61 points: (25 + 10) × 6 = 210.
  assert.equal(tarotScore(1, 'gardeContre', 61, 1, null).perDefender, 210);
  assert.equal(tarotScore(1, 'gardeSans', 61, 1, null).perDefender, 140);
  // Petit au bout: 10 × multiplier, for whoever got it, whatever the contract.
  assert.equal(tarotScore(0, 'garde', 49, 2, 0).perDefender, 66 + 20);
  assert.equal(tarotScore(0, 'garde', 49, 2, 1).perDefender, 66 - 20);
  assert.equal(tarotScore(0, 'petite', 40, 2, 1).perDefender, -26 - 10);
  // Half points round away from the target.
  assert.equal(tarotScore(0, 'petite', 40.5, 2, null).made, false);
  assert.equal(tarotScore(0, 'petite', 41.5, 2, null).gap, 1);
});

test('petit au bout compté au dernier pli', () => {
  let s = playing([['1t'], ['2h'], ['3h'], ['4h']], 0);
  for (const [p, c] of [
    [0, '1t'],
    [1, '2h'],
    [2, '3h'],
    [3, '4h'],
  ] as const)
    s = tarotApply(s, p, { type: 'play', card: c });
  assert.equal(s.result?.kind, 'played');
  if (s.result?.kind === 'played') assert.equal(s.result.petitAuBout, 0);
});

test('le robot passe avec une main faible et garde avec une belle main', () => {
  const weak = [
    '2s',
    '3s',
    '4s',
    '5s',
    '2h',
    '3h',
    '4h',
    '5h',
    '2d',
    '3d',
    '4d',
    '5d',
    '2c',
    '3c',
    '4c',
    '2t',
    '3t',
    '4t',
  ];
  assert.equal(tarotWantedContract(weak), null);
  const strong = [
    '21t',
    '20t',
    '19t',
    '18t',
    '17t',
    '15t',
    '12t',
    '9t',
    '1t',
    'EX',
    'Rs',
    'Ds',
    '3s',
    'Rh',
    '4h',
    '7d',
    '8d',
    '9d',
  ];
  const want = tarotWantedContract(strong);
  assert.ok(want === 'garde' || want === 'gardeSans' || want === 'gardeContre', String(want));
});

test('le robot charge la dame quand son partenaire est maître', () => {
  // Taker 3. Seat 0 leads the king of hearts, which nobody can beat: seat 1 gives the queen.
  let s = playing(
    [
      ['Rh', '2s'],
      ['Dh', '2h', '3s'],
      ['5s', '6s'],
      ['7h', '8h'],
    ],
    3,
  );
  s = tarotApply(s, 0, { type: 'play', card: 'Rh' });
  assert.deepEqual(tarotBotMove(s), { type: 'play', card: 'Dh' });
});

test('le robot coupe au plus juste quand il est dernier', () => {
  // Taker 0 is last, has no spades and wins with his smallest trump over the 8.
  let s = playing(
    [
      ['9t', '15t', '21t', '2h'],
      ['Rs', '3h'],
      ['8t', '4h'],
      ['5s', '5h'],
    ],
    0,
    0,
  );
  s = tarotApply(s, 1, { type: 'play', card: 'Rs' });
  s = tarotApply(s, 2, { type: 'play', card: '8t' });
  s = tarotApply(s, 3, { type: 'play', card: '5s' });
  assert.deepEqual(tarotBotMove(s), { type: 'play', card: '9t' });
});

test('fuzz : des centaines de donnes jouées par les robots respectent les règles', () => {
  const rng = seeded(7);
  let played = 0;
  let made = 0;
  let petitsAuBout = 0;
  const contracts = new Set<string>();
  for (let g = 0; g < 80; g++) {
    let s = tarotNewGame({ deals: 4, rng, dealer: g % 4 });
    let guard = 0;
    while (s.phase !== 'gameOver') {
      assert.ok(guard++ < 2000, 'la partie doit finir');
      if (s.phase === 'dealOver') {
        s = tarotNextDeal(s, rng);
        continue;
      }
      const p = s.toAct;
      const move = tarotBotMove(s);
      if (s.phase === 'ecart') {
        assert.equal(move.type, 'ecart');
        if (move.type === 'ecart') assert.equal(tarotEcartError(s.hands[p], move.cards), null);
      } else {
        const legal = tarotLegalMoves(s);
        assert.ok(
          legal.some((m) => JSON.stringify(m) === JSON.stringify(move)),
          `coup illégal ${JSON.stringify(move)}`,
        );
      }
      const before = s;
      s = tarotApply(s, p, move);
      if (s.phase === 'playing') {
        const inHands = s.hands.reduce((n, h) => n + h.length, 0);
        const piles = s.won[0].length + s.won[1].length;
        assert.equal(inHands + s.trick.length + piles, 78);
      }
      if ((s.phase === 'dealOver' || s.phase === 'gameOver') && s.result?.kind === 'played') {
        played++;
        const r = s.result;
        contracts.add(r.contract);
        if (r.made) made++;
        if (r.petitAuBout !== null) petitsAuBout++;
        assert.equal(s.won[0].length + s.won[1].length, 78);
        assert.equal(tarotCountPoints(s.won[0]) + tarotCountPoints(s.won[1]) + s.adjust[0] + s.adjust[1], 91);
        assert.equal(s.tricksWon[0] + s.tricksWon[1], 18);
        assert.equal(
          r.dealScores.reduce((a, b) => a + b, 0),
          0,
        );
        for (let i = 0; i < 4; i++) assert.equal(s.scores[i], before.scores[i] + r.dealScores[i]);
        assert.ok(s.hands.every((h) => h.length === 0));
      }
    }
    assert.equal(s.dealNumber, 4);
    assert.equal(
      s.scores.reduce((a, b) => a + b, 0),
      0,
    );
    assert.ok(s.winners && s.winners.length >= 1);
    for (const w of s.winners!) assert.equal(s.scores[w], Math.max(...s.scores));
  }
  assert.ok(played >= 320, `${played} donnes`);
  assert.ok(made > played * 0.35 && made < played, `${made} contrats réussis sur ${played}`);
  assert.ok(contracts.has('petite') && contracts.has('garde'), [...contracts].join());
  assert.ok(petitsAuBout >= 0);
});

test('l’Excuse jouée par les robots ne finit jamais au dernier pli', () => {
  const rng = seeded(99);
  for (let g = 0; g < 40; g++) {
    let s = tarotNewGame({ deals: 1, rng });
    while (s.phase !== 'gameOver') {
      if (s.phase === 'dealOver') {
        s = tarotNextDeal(s, rng);
        continue;
      }
      s = tarotApply(s, s.toAct, tarotBotMove(s));
    }
    const last = s.tricks[17];
    assert.ok(!last.cards.some((p) => p.card === TAROT_EXCUSE));
  }
});
