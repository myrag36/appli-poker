import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type BeloteState,
  type BeloteSuit,
  BELOTE_SUITS,
  beloteApply,
  beloteBotMove,
  beloteLegalCards,
  beloteLegalMoves,
  beloteNewDeck,
  beloteNewGame,
  beloteNextDeal,
  belotePoints,
  beloteScore,
  beloteStartDeal,
  beloteStrength,
  beloteTrickWinnerIndex,
} from '../src/belote.ts';
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

/**
 * Builds a deck so that, once `taker` takes the turned-up card in round 1, each player ends with
 * `final[p]` (the taker's final hand must contain `turnUp`).
 */
function rig(dealer: number, taker: number, final: Card[][], turnUp: Card): Card[] {
  const rest = final.map((h) => h.filter((c) => c !== turnUp));
  const deck: Card[] = [];
  let offset = 0;
  for (const count of [3, 2]) {
    for (let i = 1; i <= 4; i++) deck.push(...rest[(dealer + i) % 4].slice(offset, offset + count));
    offset += count;
  }
  deck.push(turnUp);
  for (let i = 1; i <= 4; i++) {
    const p = (dealer + i) % 4;
    deck.push(...rest[p].slice(5, p === taker ? 7 : 8));
  }
  return deck;
}

/** A position in the middle of play with the given hands. */
function playing(hands: Card[][], trump: BeloteSuit, taker = 0, dealer = 3): BeloteState {
  const s = beloteStartDeal({ dealer, rng: seeded(1) });
  const holder = hands.findIndex((h) => h.includes('K' + trump) && h.includes('Q' + trump));
  return {
    ...s,
    phase: 'playing',
    hands,
    stock: [],
    trump,
    taker,
    toAct: (dealer + 1) % 4,
    beloteHolder: holder >= 0 ? holder : null,
  };
}

const t = (player: number, card: Card) => ({ player, card });

test('le paquet a 32 cartes et vaut 152 points (162 avec le dix de der) quel que soit l’atout', () => {
  const deck = beloteNewDeck();
  assert.equal(deck.length, 32);
  assert.equal(new Set(deck).size, 32);
  for (const trump of BELOTE_SUITS) {
    assert.equal(
      deck.reduce((s, c) => s + belotePoints(c, trump), 0),
      152,
    );
  }
  assert.equal(belotePoints('Jh', 'h'), 20);
  assert.equal(belotePoints('9h', 'h'), 14);
  assert.equal(belotePoints('Jh', 's'), 2);
  assert.equal(belotePoints('9h', 's'), 0);
  assert.equal(belotePoints('Ah', 's'), 11);
  assert.equal(belotePoints('Th', 'h'), 10);
});

test('ordre des cartes : atout J 9 A 10 K Q 8 7, sinon A 10 K Q J 9 8 7', () => {
  const trumpOrder = ['Jh', '9h', 'Ah', 'Th', 'Kh', 'Qh', '8h', '7h'];
  for (let i = 1; i < trumpOrder.length; i++)
    assert.ok(beloteStrength(trumpOrder[i - 1], 'h') > beloteStrength(trumpOrder[i], 'h'));
  const plainOrder = ['As', 'Ts', 'Ks', 'Qs', 'Js', '9s', '8s', '7s'];
  for (let i = 1; i < plainOrder.length; i++)
    assert.ok(beloteStrength(plainOrder[i - 1], 'h') > beloteStrength(plainOrder[i], 'h'));
});

test('distribution : 5 cartes chacun puis 8 après la prise', () => {
  const s = beloteStartDeal({ dealer: 2, rng: seeded(3) });
  assert.equal(s.phase, 'bidding1');
  for (const h of s.hands) assert.equal(h.length, 5);
  assert.equal(s.stock.length, 11);
  assert.ok(s.turnUp);
  assert.equal(s.toAct, 3, 'la parole est à gauche du donneur');
  const all = [...s.hands.flat(), s.turnUp!, ...s.stock];
  assert.equal(new Set(all).size, 32);

  const taken = beloteApply(s, 3, { type: 'take' });
  assert.equal(taken.phase, 'playing');
  assert.equal(taken.trump, s.turnUp![1]);
  assert.equal(taken.taker, 3);
  for (const h of taken.hands) assert.equal(h.length, 8);
  assert.ok(taken.hands[3].includes(s.turnUp!), 'le preneur ramasse la retourne');
  assert.equal(taken.stock.length, 0);
  assert.equal(new Set(taken.hands.flat()).size, 32);
  assert.equal(taken.toAct, 3, 'le joueur à gauche du donneur entame');
});

test('enchères : premier tour, second tour puis redistribution', () => {
  let s = beloteStartDeal({ dealer: 0, rng: seeded(5) });
  assert.deepEqual(beloteLegalMoves(s), [{ type: 'take' }, { type: 'pass' }]);
  assert.throws(() => beloteApply(s, 2, { type: 'pass' }), /pas ton tour/);
  assert.throws(() => beloteApply(s, 1, { type: 'choose', suit: 's' }));
  for (const p of [1, 2, 3, 0]) s = beloteApply(s, p, { type: 'pass' });
  assert.equal(s.phase, 'bidding2');
  assert.equal(s.toAct, 1);
  const turned = s.turnUp![1];
  const moves = beloteLegalMoves(s);
  assert.equal(moves.length, 4);
  assert.ok(!moves.some((m) => m.type === 'choose' && m.suit === turned));
  assert.throws(() => beloteApply(s, 1, { type: 'choose', suit: turned as BeloteSuit }), /autre couleur/);
  assert.throws(() => beloteApply(s, 1, { type: 'take' }));

  // Someone names a suit in round 2.
  const other = BELOTE_SUITS.find((x) => x !== turned)!;
  const s2 = beloteApply(beloteApply(s, 1, { type: 'pass' }), 2, { type: 'choose', suit: other });
  assert.equal(s2.phase, 'playing');
  assert.equal(s2.trump, other);
  assert.equal(s2.taker, 2);
  assert.ok(s2.hands[2].includes(s.turnUp!));
  for (const h of s2.hands) assert.equal(h.length, 8);

  // Everyone passes twice: deal again, by the next dealer.
  for (const p of [1, 2, 3, 0]) s = beloteApply(s, p, { type: 'pass' });
  assert.equal(s.phase, 'dealOver');
  assert.deepEqual(s.result, { kind: 'redeal' });
  assert.deepEqual(s.scores, [0, 0]);
  const again = beloteNextDeal(s, seeded(9));
  assert.equal(again.dealer, 1);
  assert.equal(again.toAct, 2);
  assert.equal(again.phase, 'bidding1');
  assert.equal(again.dealNumber, 2);
});

test('pli : l’atout gagne, sinon la plus forte de la couleur demandée', () => {
  assert.equal(beloteTrickWinnerIndex([t(0, 'Ks'), t(1, 'As'), t(2, '7h'), t(3, 'Ts')], 'h'), 2);
  assert.equal(beloteTrickWinnerIndex([t(0, 'Ks'), t(1, 'As'), t(2, 'Ad'), t(3, 'Ts')], 'h'), 1);
  assert.equal(beloteTrickWinnerIndex([t(0, '9h'), t(1, 'Ah'), t(2, 'Jh'), t(3, 'Th')], 'h'), 2);
  assert.equal(beloteTrickWinnerIndex([t(0, '7s'), t(1, '8h'), t(2, '9h'), t(3, 'As')], 'h'), 2);
  // A jack is weak outside trump.
  assert.equal(beloteTrickWinnerIndex([t(0, 'Js'), t(1, 'Qs'), t(2, '9s'), t(3, '8s')], 'h'), 1);
});

test('règle : fournir la couleur demandée', () => {
  const hand = ['As', '7s', 'Jh', 'Kd'];
  assert.deepEqual(beloteLegalCards(hand, [t(3, 'Ts')], 'h', 0).sort(), ['7s', 'As']);
  assert.deepEqual(beloteLegalCards(hand, [], 'h', 0).sort(), hand.slice().sort());
  // Following suit is enough even when the opponent is winning.
  assert.deepEqual(beloteLegalCards(hand, [t(2, 'Ts'), t(3, '7h')], 'h', 0).sort(), ['7s', 'As']);
});

test('règle : couper quand on ne peut pas fournir', () => {
  const hand = ['8h', 'Jh', 'Kd', 'Ac'];
  assert.deepEqual(beloteLegalCards(hand, [t(3, 'Ts')], 'h', 0).sort(), ['8h', 'Jh']);
  // No trump either: anything.
  assert.deepEqual(beloteLegalCards(['Kd', 'Ac'], [t(3, 'Ts')], 'h', 0).sort(), ['Ac', 'Kd']);
});

test('règle : partenaire maître, on joue ce qu’on veut', () => {
  const hand = ['8h', 'Jh', 'Kd', 'Ac'];
  // North (2) is South's partner and wins the trick.
  assert.deepEqual(
    beloteLegalCards(hand, [t(1, '7s'), t(2, 'As'), t(3, '8s')], 'h', 0).sort(),
    hand.slice().sort(),
  );
  // Partner master by trumping: still free.
  assert.deepEqual(
    beloteLegalCards(hand, [t(1, '7s'), t(2, '7h'), t(3, '8s')], 'h', 0).sort(),
    hand.slice().sort(),
  );
  // Partner was master but got overtrumped: must overtrump.
  assert.deepEqual(beloteLegalCards(hand, [t(1, '7s'), t(2, '7h'), t(3, 'Qh')], 'h', 0), ['Jh']);
});

test('règle : surcouper, et pisser si on ne peut pas', () => {
  // West trumped with the queen: only higher trumps.
  assert.deepEqual(beloteLegalCards(['8h', 'Ah', 'Kd'], [t(3, 'Ts'), t(1, 'Qh')], 'h', 0).sort(), ['Ah']);
  // Cannot overtrump the jack: must still play a lower trump.
  assert.deepEqual(beloteLegalCards(['8h', 'Ah', 'Kd'], [t(3, 'Ts'), t(1, 'Jh')], 'h', 0).sort(), [
    '8h',
    'Ah',
  ]);
  // Same for the partner of the leader when the opponent trumped.
  assert.deepEqual(beloteLegalCards(['8h', '9h', 'Kd'], [t(1, 'Ts'), t(2, 'As'), t(3, 'Ah')], 'h', 0), [
    '9h',
  ]);
});

test('règle : atout demandé, il faut monter si on peut', () => {
  const hand = ['7h', 'Ah', '9h', 'Kd'];
  assert.deepEqual(beloteLegalCards(hand, [t(3, 'Th')], 'h', 0).sort(), ['9h', 'Ah']);
  // Even when the partner is master.
  assert.deepEqual(beloteLegalCards(hand, [t(2, 'Th'), t(3, '8h')], 'h', 0).sort(), ['9h', 'Ah']);
  // The jack is out: any trump.
  assert.deepEqual(beloteLegalCards(hand, [t(3, 'Jh')], 'h', 0).sort(), ['7h', '9h', 'Ah']);
  // No trump: anything.
  assert.deepEqual(beloteLegalCards(['Kd', 'As'], [t(3, 'Jh')], 'h', 0).sort(), ['As', 'Kd']);
});

test('jouer une carte interdite ou absente est refusé', () => {
  const s = playing(
    [
      ['As', 'Kd', '7c', '8c', '9c', 'Tc', 'Jc', 'Qc'],
      ['Ks', 'Ad', 'Td', 'Qd', 'Jd', '9d', '8d', '7d'],
      ['Ts', 'Ac', 'Kc', 'Jh', '9h', 'Ah', 'Th', 'Kh'],
      ['Qs', 'Js', '9s', '8s', '7s', 'Qh', '8h', '7h'],
    ],
    'h',
  );
  assert.equal(s.toAct, 0);
  assert.throws(() => beloteApply(s, 0, { type: 'play', card: 'Ks' }), /pas cette carte/);
  const s1 = beloteApply(s, 0, { type: 'play', card: 'As' });
  assert.throws(() => beloteApply(s1, 1, { type: 'play', card: 'Ad' }), /pas permise/);
  assert.throws(() => beloteApply(s1, 1, { type: 'take' }));
  assert.equal(beloteApply(s1, 1, { type: 'play', card: 'Ks' }).toAct, 2);
});

test('belote et rebelote, capot et fin de partie', () => {
  // South takes hearts and holds all of them: 8 tricks in a row.
  const final = [
    ['Jh', '9h', 'Ah', 'Th', 'Kh', 'Qh', '8h', '7h'],
    ['As', 'Ks', 'Qs', 'Js', 'Ts', '9s', '8s', '7s'],
    ['Ad', 'Kd', 'Qd', 'Jd', 'Td', '9d', '8d', '7d'],
    ['Ac', 'Kc', 'Qc', 'Jc', 'Tc', '9c', '8c', '7c'],
  ];
  const deck = rig(3, 0, final, '7h');
  let s = beloteStartDeal({ dealer: 3, deck, scores: [800, 300], target: 1000 });
  assert.equal(s.turnUp, '7h');
  s = beloteApply(s, 0, { type: 'take' });
  assert.deepEqual(s.hands[0].slice().sort(), final[0].slice().sort());
  assert.equal(s.beloteHolder, 0);
  const announces: string[] = [];
  while (s.phase === 'playing') {
    const p = s.toAct;
    const move = p === 0 ? { type: 'play' as const, card: s.hands[0][0] } : beloteBotMove(s);
    s = beloteApply(s, p, move);
    if (s.announce) announces.push(`${s.announce.player}:${s.announce.text}`);
    if (s.lastTrick && s.trick.length === 0 && s.phase === 'playing') assert.equal(s.lastTrick.winner, 0);
  }
  assert.deepEqual(announces, ['0:Belote', '0:Rebelote']);
  assert.equal(s.result?.kind, 'played');
  if (s.result?.kind !== 'played') return;
  assert.deepEqual(s.tricksWon, [8, 0]);
  assert.equal(s.points[0], 162);
  assert.equal(s.result.capot, 0);
  assert.equal(s.result.made, true);
  assert.deepEqual(s.result.belote, [20, 0]);
  assert.deepEqual(s.result.dealPoints, [272, 0]);
  assert.deepEqual(s.scores, [1072, 300]);
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.winner, 0);
  assert.throws(() => beloteNextDeal(s));
});

test('score : contrat réussi, chacun marque ses points', () => {
  const r = beloteScore(1, 's', [62, 100], [3, 5], null);
  assert.equal(r.made, true);
  assert.deepEqual(r.dealPoints, [62, 100]);
  // Belote helps the defence too.
  const r2 = beloteScore(1, 's', [62, 100], [3, 5], 0);
  assert.deepEqual(r2.dealPoints, [82, 100]);
});

test('score : dedans, la défense prend 162 et le preneur garde sa belote', () => {
  const r = beloteScore(0, 'h', [70, 92], [3, 5], null);
  assert.equal(r.made, false);
  assert.deepEqual(r.dealPoints, [0, 162]);
  // Equal totals are not enough: the taker must do strictly better.
  const tie = beloteScore(0, 'h', [81, 81], [4, 4], null);
  assert.equal(tie.made, false);
  const withBelote = beloteScore(0, 'h', [71, 91], [4, 4], 0);
  assert.equal(withBelote.made, false, '71 + 20 = 91, pas strictement plus');
  assert.deepEqual(withBelote.dealPoints, [20, 162]);
  const defenceBelote = beloteScore(0, 'h', [70, 92], [4, 4], 1);
  assert.deepEqual(defenceBelote.dealPoints, [0, 182]);
  // Belote can save the contract.
  assert.equal(beloteScore(0, 'h', [75, 87], [4, 4], 0).made, true);
});

test('score : capot de la défense', () => {
  const r = beloteScore(0, 'h', [0, 162], [0, 8], null);
  assert.equal(r.made, false);
  assert.equal(r.capot, 1);
  assert.deepEqual(r.dealPoints, [0, 252]);
  const own = beloteScore(1, 'h', [0, 162], [0, 8], 1);
  assert.equal(own.made, true);
  assert.deepEqual(own.dealPoints, [0, 272]);
});

test('fin de partie : la plus haute équipe au-dessus de la cible gagne', () => {
  let checked = 0;
  for (let seed = 1; seed < 200 && checked < 5; seed++) {
    const rng = seeded(seed);
    let s = beloteStartDeal({ dealer: 0, rng, scores: [450, 460], target: 501 });
    while (s.phase === 'bidding1' || s.phase === 'bidding2' || s.phase === 'playing')
      s = beloteApply(s, s.toAct, beloteBotMove(s));
    if (s.result?.kind !== 'played') continue;
    const [a, b] = s.scores;
    if (Math.max(a, b) >= 501 && a !== b) {
      assert.equal(s.phase, 'gameOver');
      assert.equal(s.winner, a > b ? 0 : 1);
      checked++;
    } else {
      assert.equal(s.phase, 'dealOver');
    }
  }
  assert.ok(checked >= 3);
});

test('le robot prend avec le valet et un autre atout, passe avec une main faible', () => {
  const base = beloteStartDeal({ dealer: 3, rng: seeded(2) });
  const strong: BeloteState = {
    ...base,
    turnUp: '7h',
    hands: [['Jh', '8s', '9d', '7c', 'Kc'], ...base.hands.slice(1)],
  };
  assert.deepEqual(beloteBotMove(strong), { type: 'take' });
  const weak: BeloteState = {
    ...base,
    turnUp: '7h',
    hands: [['8s', '9d', '7c', 'Kc', 'Qd'], ...base.hands.slice(1)],
  };
  assert.deepEqual(beloteBotMove(weak), { type: 'pass' });
  const round2: BeloteState = {
    ...base,
    phase: 'bidding2',
    turnUp: '7h',
    hands: [['Js', '9s', 'As', 'Ad', '7c'], ...base.hands.slice(1)],
  };
  assert.deepEqual(beloteBotMove(round2), { type: 'choose', suit: 's' });
});

test('le robot charge son partenaire maître et entame ses as', () => {
  const s = playing(
    [
      ['As', 'Kd', '7c', '8c', '9c', 'Tc', 'Jc', 'Qc'],
      ['Ks', 'Ad', 'Td', 'Qd', 'Jd', '9d', '8d', '7d'],
      ['Ts', '7s', 'Kc', 'Jh', '9h', 'Ah', 'Th', 'Kh'],
      ['Qs', 'Js', '9s', '8s', 'Ac', 'Qh', '8h', '7h'],
    ],
    'h',
    1,
  );
  assert.deepEqual(beloteBotMove(s), { type: 'play', card: 'As' });
  let s1 = beloteApply(s, 0, { type: 'play', card: 'As' });
  s1 = beloteApply(s1, 1, { type: 'play', card: 'Ks' });
  // North (partner of South, who is master) gives the ten.
  assert.deepEqual(beloteBotMove(s1), { type: 'play', card: 'Ts' });
});

test('fuzz : des centaines de donnes jouées par les robots respectent les règles', () => {
  const rng = seeded(42);
  let deals = 0;
  let games = 0;
  let capots = 0;
  let dedans = 0;
  for (let g = 0; g < 60; g++) {
    let s = beloteNewGame({ target: g % 2 ? 501 : 1000, rng, dealer: g % 4 });
    let guard = 0;
    while (s.phase !== 'gameOver') {
      assert.ok(guard++ < 5000, 'la partie doit finir');
      if (s.phase === 'dealOver') {
        s = beloteNextDeal(s, rng);
        continue;
      }
      const p = s.toAct;
      const legal = beloteLegalMoves(s);
      assert.ok(legal.length > 0);
      const move = beloteBotMove(s);
      assert.ok(
        legal.some((m) => JSON.stringify(m) === JSON.stringify(move)),
        `coup illégal ${JSON.stringify(move)}`,
      );
      const before = s;
      s = beloteApply(s, p, move);
      if (before.phase === 'playing') {
        const inHands = s.hands.reduce((n, h) => n + h.length, 0);
        assert.equal(inHands + s.trick.length, 32 - 4 * (s.tricksWon[0] + s.tricksWon[1]));
      }
      if ((before.phase === 'bidding1' || before.phase === 'bidding2') && s.phase === 'playing') {
        for (const h of s.hands) assert.equal(h.length, 8);
        assert.equal(new Set(s.hands.flat()).size, 32);
      }
      if (s.phase === 'dealOver' || s.phase === 'gameOver') {
        const r = s.result!;
        if (r.kind === 'played') {
          deals++;
          assert.equal(s.points[0] + s.points[1], 162);
          assert.equal(s.tricksWon[0] + s.tricksWon[1], 8);
          assert.ok(s.hands.every((h) => h.length === 0));
          assert.equal(s.belotePlayed, s.beloteHolder === null ? 0 : 2);
          if (r.capot !== null) capots++;
          if (!r.made) dedans++;
          assert.equal(
            s.scores[0] + s.scores[1] - before.scores[0] - before.scores[1],
            r.dealPoints[0] + r.dealPoints[1],
          );
          const total = r.dealPoints[0] + r.dealPoints[1] - r.belote[0] - r.belote[1];
          assert.equal(total, r.capot !== null ? 252 : 162);
        }
      }
    }
    games++;
    assert.ok(s.winner !== null);
    assert.ok(s.scores[s.winner] >= s.target);
    assert.ok(s.scores[s.winner] > s.scores[1 - s.winner]);
  }
  assert.equal(games, 60);
  assert.ok(deals > 300, `${deals} donnes`);
  assert.ok(dedans > 0, 'il y a des chutes');
  assert.ok(capots >= 0);
});
