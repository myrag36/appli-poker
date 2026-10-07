import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, Rng } from '../src/cards.ts';
import {
  type BjState,
  bjActor,
  bjApply,
  bjBasicStrategy,
  bjBotBet,
  bjBotMove,
  bjChips,
  bjHandValue,
  bjIsBlackjack,
  bjIsOver,
  bjLegalActions,
  bjNewGame,
  bjNextRound,
  bjRanking,
  bjRoundNet,
  bjTotalLabel,
} from '../src/blackjack.ts';

/** Small deterministic generator so failures can be replayed. */
function seeded(seed: number): Rng {
  let x = seed >>> 0 || 1;
  return (max) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % max;
  };
}
const rng = seeded(42);
/** Padding after the rigged cards, so the one-deck shoe is never reshuffled by accident. */
const PAD: Card[] = Array.from({ length: 40 }, () => '2c');

/**
 * A game with a rigged shoe. Deal order: each player's first card, the dealer's up card,
 * each player's second card, the dealer's hole card, then hits in order.
 */
function rigged(cards: Card[], opts: { players?: number; stack?: number; bots?: boolean[] } = {}) {
  const n = opts.players ?? 1;
  return bjNewGame(
    {
      players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `J${i}`, bot: opts.bots?.[i] })),
      stack: opts.stack ?? 1000,
      decks: 1,
      shoe: [...cards, ...PAD],
    },
    rng,
  );
}

function betAll(s: BjState, amounts: number[]): BjState {
  for (const amount of amounts) s = bjApply(s, { type: 'bet', amount }, rng);
  return s;
}

const play = (s: BjState, ...moves: ('hit' | 'stand' | 'double' | 'split')[]) =>
  moves.reduce((st, type) => bjApply(st, { type }, rng), s);

test('totaux durs et souples, avec plusieurs as', () => {
  assert.deepEqual(bjHandValue(['As', 'Ad']), { total: 12, soft: true, low: 2 });
  assert.deepEqual(bjHandValue(['As', 'Ad', '9c']), { total: 21, soft: true, low: 11 });
  assert.deepEqual(bjHandValue(['As', 'Ad', 'Ac', '8h']), { total: 21, soft: true, low: 11 });
  assert.deepEqual(bjHandValue(['As', 'Ad', 'Ac', 'Ah', 'Kc']), { total: 14, soft: false, low: 14 });
  assert.deepEqual(bjHandValue(['As', '6d', 'Kc']), { total: 17, soft: false, low: 17 });
  assert.deepEqual(bjHandValue(['As', '5d', 'Ac']), { total: 17, soft: true, low: 7 });
  assert.deepEqual(bjHandValue(['Ks', 'Qd', '5c']), { total: 25, soft: false, low: 25 });
  assert.equal(bjTotalLabel(['As', '6d']), '7/17');
  assert.equal(bjTotalLabel(['As', 'Kd']), '21');
  assert.equal(bjTotalLabel(['Ts', '7d']), '17');
  assert.equal(bjTotalLabel(['As', '6d', 'Kc']), '17');
  assert.ok(bjIsBlackjack(['As', 'Jd']));
  assert.ok(!bjIsBlackjack(['7s', '4d', 'Td']));
});

test('blackjack payé 3:2, un 21 en trois cartes ne vaut pas un blackjack', () => {
  // Player A,K; dealer 9 then 7, draws 5 to 21.
  let s = rigged(['As', '9h', 'Kd', '7c', '5s']);
  s = betAll(s, [10]);
  assert.equal(s.phase, 'settled');
  assert.equal(s.seats[0].hands[0].result, 'blackjack');
  assert.equal(s.players[0].stack, 1000 + 15);
  assert.equal(bjRoundNet(s, 'p0'), 15);
  // The dealer did not draw: nothing left to beat.
  assert.equal(s.dealer.length, 2);

  // Player 7,4 + T = 21 against the dealer's blackjack-less 21: a push.
  s = rigged(['7s', '9h', '4d', '7c', 'Td', '5s']);
  s = play(betAll(s, [10]), 'hit');
  assert.equal(bjHandValue(s.dealer).total, 21);
  assert.equal(s.seats[0].hands[0].result, 'push');
  assert.equal(s.players[0].stack, 1000);
});

test('gain 3:2 arrondi à l’inférieur', () => {
  for (const [bet, gain] of [
    [25, 37],
    [15, 22],
    [11, 16],
    [10, 15],
  ]) {
    const s = betAll(rigged(['As', '9h', 'Kd', '8c']), [bet]);
    assert.equal(s.seats[0].hands[0].payout, bet + gain);
    assert.equal(s.players[0].stack, 1000 + gain);
  }
});

test('le croupier tire jusqu’à 16 et reste sur tous les 17, même souples', () => {
  // Dealer A,6 = soft 17: stands.
  let s = play(betAll(rigged(['Ts', 'As', '8d', '6c']), [10]), 'stand');
  assert.deepEqual(s.dealer, ['As', '6c']);
  assert.equal(s.seats[0].hands[0].result, 'win');
  // Dealer T,6 = 16: draws a 2 (18), then stands.
  s = play(betAll(rigged(['Ts', 'Th', '7d', '6c', '2d', '9s']), [10]), 'stand');
  assert.deepEqual(s.dealer, ['Th', '6c', '2d']);
  assert.equal(s.seats[0].hands[0].result, 'lose');
  assert.equal(s.players[0].stack, 990);
  // Dealer 5,A = soft 16, draws a 6 (hard 12), then a 9: bust.
  s = play(betAll(rigged(['Ts', '5h', '7d', 'Ac', '6d', '9s']), [10]), 'stand');
  assert.equal(bjHandValue(s.dealer).total, 21);
  assert.deepEqual(s.dealer, ['5h', 'Ac', '6d', '9s']);
  s = play(betAll(rigged(['Ts', '5h', '7d', 'Ac', '6d', 'Ks']), [10]), 'stand');
  assert.equal(bjHandValue(s.dealer).total, 22);
  assert.equal(s.seats[0].hands[0].result, 'win');
  assert.equal(s.players[0].stack, 1010);
});

test('le croupier vérifie son blackjack sous un as ou un dix', () => {
  // Two players: p0 has 20, p1 has blackjack; dealer A up, K in the hole.
  let s = rigged(['Ts', 'Ah', 'As', 'Td', 'Kc', 'Kd'], { players: 2 });
  s = betAll(s, [50, 20]);
  assert.equal(s.phase, 'settled');
  assert.ok(s.dealerBlackjack);
  assert.ok(s.holeRevealed);
  assert.equal(s.seats[0].hands[0].result, 'lose');
  assert.equal(s.seats[1].hands[0].result, 'push');
  assert.deepEqual(
    s.players.map((p) => p.stack),
    [950, 1000],
  );
  // A ten up with an ace in the hole works the same way.
  s = betAll(rigged(['9s', 'Kh', '9d', 'Ac']), [10]);
  assert.ok(s.dealerBlackjack);
  assert.equal(s.seats[0].hands[0].result, 'lose');
  // No blackjack under the ace: play goes on as usual.
  s = betAll(rigged(['9s', 'Ah', '9d', '7c']), [10]);
  assert.equal(s.phase, 'playing');
  assert.equal(bjActor(s), 'p0');
});

test('doubler : une seule carte, mise doublée, seulement sur deux cartes', () => {
  let s = betAll(rigged(['6s', '6h', '5d', 'Tc', 'Th', '8c']), [20]);
  assert.ok(bjLegalActions(s).includes('double'));
  s = play(s, 'double');
  const h = s.seats[0].hands[0];
  assert.ok(h.doubled);
  assert.equal(h.cards.length, 3);
  assert.equal(h.bet, 40);
  // Dealer 6,T draws 8: bust. Player wins 40.
  assert.equal(h.result, 'win');
  assert.equal(s.players[0].stack, 1040);

  // No doubling once a third card is taken.
  s = play(betAll(rigged(['2s', '6h', '3d', 'Tc', '2h']), [20]), 'hit');
  assert.deepEqual(bjLegalActions(s), ['hit', 'stand']);

  // Not enough chips left to match the bet.
  s = betAll(rigged(['6s', '6h', '5d', 'Tc'], { stack: 100 }), [60]);
  assert.deepEqual(bjLegalActions(s), ['hit', 'stand']);
  assert.throws(() => play(s, 'double'));
});

test('séparer une paire : deux mains, une seule fois', () => {
  // Player 8,8 vs dealer 6; split, hands get 8 (no re-split) and 3 (then double after split).
  let s = betAll(rigged(['8s', '6h', '8d', 'Tc', '8c', '3d', 'Ts', 'Kh', '9s']), [25]);
  assert.ok(bjLegalActions(s).includes('split'));
  s = play(s, 'split');
  assert.equal(s.seats[0].hands.length, 2);
  assert.deepEqual(s.seats[0].hands[0].cards, ['8s', '8c']);
  assert.deepEqual(s.seats[0].hands[1].cards, ['8d', '3d']);
  assert.equal(s.players[0].stack, 950);
  assert.equal(bjChips(s, 'p0'), 1000);
  // Only one split per player.
  assert.ok(!bjLegalActions(s).includes('split'));
  s = play(s, 'stand');
  assert.deepEqual(s.turn, { seat: 0, hand: 1 });
  assert.ok(bjLegalActions(s).includes('double'));
  s = play(s, 'double'); // 8,3 + T = 21
  // Dealer 6,T draws K: bust.
  assert.equal(s.phase, 'settled');
  assert.equal(s.seats[0].hands[0].result, 'win');
  assert.equal(s.seats[0].hands[1].result, 'win');
  assert.equal(s.players[0].stack, 1000 + 25 + 50);

  // Only same-rank pairs: K,Q cannot be split.
  s = betAll(rigged(['Ks', '6h', 'Qd', 'Tc']), [10]);
  assert.ok(!bjLegalActions(s).includes('split'));
});

test('as séparés : une carte chacun, et 21 n’est pas un blackjack', () => {
  // Player A,A vs dealer T up, 9 hole (no blackjack); split gets K and 5.
  let s = betAll(rigged(['As', 'Th', 'Ad', '9c', 'Kc', '5d']), [10]);
  s = play(s, 'split');
  assert.equal(s.phase, 'settled');
  const [a, b] = s.seats[0].hands;
  assert.deepEqual(a.cards, ['As', 'Kc']);
  assert.deepEqual(b.cards, ['Ad', '5d']);
  // 21 after a split is a plain win, paid 1:1.
  assert.equal(a.result, 'win');
  assert.equal(a.payout, 20);
  assert.equal(b.result, 'lose');
  assert.equal(s.players[0].stack, 1000);
});

test('joueur qui dépasse 21 perd, même si le croupier saute aussi', () => {
  let s = betAll(rigged(['Ts', '6h', '6d', 'Tc', 'Kd', 'Ks'], { players: 1 }), [100]);
  s = play(s, 'hit');
  assert.equal(s.seats[0].hands[0].result, 'bust');
  // The dealer does not draw when every hand is already bust.
  assert.equal(s.dealer.length, 2);
  assert.equal(s.players[0].stack, 900);
});

test('mises : entre 10 et le tapis, tapis entier en dessous de 10', () => {
  let s = rigged([], { stack: 1000 });
  assert.throws(() => bjApply(s, { type: 'bet', amount: 5 }, rng));
  assert.throws(() => bjApply(s, { type: 'bet', amount: 1001 }, rng));
  assert.throws(() => bjApply(s, { type: 'bet', amount: 12.5 }, rng));
  s = rigged([], { stack: 7 });
  assert.equal(bjApply(s, { type: 'bet', amount: 7 }, rng).phase, 'playing');
  assert.equal(bjBotBet(1000), 50);
  assert.equal(bjBotBet(130), 10);
  assert.equal(bjBotBet(7), 7);
  assert.equal(bjBotBet(990), 50);
  assert.equal(bjBotBet(1110), 55);
});

test('le sabot est remélangé sous 25 %', () => {
  // One deck: fewer than 13 cards left before a round means a fresh shoe.
  const g = bjNewGame({ players: [{ id: 'p0', name: 'A' }], stack: 1000, decks: 1, shoe: ['Ts', '9h'] }, rng);
  const s = bjApply(g, { type: 'bet', amount: 10 }, rng);
  assert.ok(s.reshuffled);
  const onTable = s.dealer.length + s.seats[0].hands[0].cards.length;
  assert.equal(s.shoe.length + onTable, 52);

  // Six decks: 312 cards, still enough at 78, reshuffled at 77.
  let six = bjNewGame({ players: [{ id: 'p0', name: 'A' }], stack: 1000 }, seeded(7));
  assert.equal(six.shoe.length, 312);
  six = { ...six, shoe: six.shoe.slice(0, 78), discarded: 234 };
  assert.ok(!bjApply(six, { type: 'bet', amount: 10 }, rng).reshuffled);
  six = { ...six, shoe: six.shoe.slice(0, 77), discarded: 235 };
  const r = bjApply(six, { type: 'bet', amount: 10 }, rng);
  assert.ok(r.reshuffled);
  assert.equal(r.discarded, 0);
});

test('un joueur sans jetons est éliminé ; la partie finit quand plus aucun humain n’a de jetons', () => {
  // p0 (human) all-in and loses; p1 is a robot and wins.
  let s = rigged(['Ts', '9s', 'Th', '6c', 'Td', '7d'], { players: 2, stack: 100, bots: [false, true] });
  s = betAll(s, [100, 10]);
  s = play(s, 'stand');
  // p1 (robot) stands on 19 and beats the dealer's 17.
  s = play(s, 'stand');
  assert.equal(s.phase, 'settled');
  assert.equal(s.players[0].stack, 0);
  assert.ok(bjIsOver(s));
  assert.throws(() => bjNextRound(s));
  assert.deepEqual(
    bjRanking(s).map((r) => [r.name, r.chips, r.place]),
    [
      ['J1', 110, 1],
      ['J0', 0, 2],
    ],
  );

  // With two humans, the broke one sits out the next round.
  s = rigged(['Ts', '9s', 'Th', '6c', 'Td', '7d'], { players: 2, stack: 100 });
  s = play(play(betAll(s, [100, 10]), 'stand'), 'stand');
  assert.ok(!bjIsOver(s));
  s = bjNextRound(s);
  assert.equal(s.phase, 'betting');
  assert.equal(bjActor(s), 'p1');
  s = bjApply(s, { type: 'bet', amount: 10 }, rng);
  assert.deepEqual(
    s.seats.map((x) => x.playerId),
    ['p1'],
  );
});

test('stratégie de base des robots', () => {
  const all = ['hit', 'stand', 'double', 'split'] as const;
  const legal = [...all];
  assert.equal(bjBasicStrategy(['8s', '8d'], 'Th', legal), 'split');
  assert.equal(bjBasicStrategy(['As', 'Ad'], 'Ah', legal), 'split');
  assert.equal(bjBasicStrategy(['Ts', 'Kd'], '6h', legal), 'stand');
  assert.equal(bjBasicStrategy(['9s', '9d'], '7h', legal), 'stand');
  assert.equal(bjBasicStrategy(['5s', '5d'], '6h', legal), 'double');
  assert.equal(bjBasicStrategy(['6s', '5d'], 'Ah', legal), 'hit');
  assert.equal(bjBasicStrategy(['Ts', '6d'], '7h', legal), 'hit');
  assert.equal(bjBasicStrategy(['Ts', '6d'], '6h', legal), 'stand');
  assert.equal(bjBasicStrategy(['Ts', '2d'], '3h', legal), 'hit');
  assert.equal(bjBasicStrategy(['Ts', '2d'], '4h', legal), 'stand');
  assert.equal(bjBasicStrategy(['As', '7d'], '3h', legal), 'double');
  assert.equal(bjBasicStrategy(['As', '7d'], '3h', ['hit', 'stand']), 'stand');
  assert.equal(bjBasicStrategy(['As', '7d'], '9h', legal), 'hit');
  assert.equal(bjBasicStrategy(['As', '7d'], '8h', legal), 'stand');
  assert.equal(bjBasicStrategy(['As', '2d', '3c'], '5h', ['hit', 'stand']), 'hit');
  assert.equal(bjBasicStrategy(['4s', '4d'], '5h', legal), 'split');
  assert.equal(bjBasicStrategy(['4s', '4d'], '5h', ['hit', 'stand']), 'hit');
});

/** Every card is in the shoe, on the table or already played. */
function checkInvariants(s: BjState) {
  for (const p of s.players) {
    assert.ok(Number.isInteger(p.stack) && p.stack >= 0, `tapis invalide ${p.stack}`);
  }
  const onTable =
    s.dealer.length + s.seats.reduce((n, x) => n + x.hands.reduce((m, h) => m + h.cards.length, 0), 0);
  assert.equal(s.shoe.length + onTable + s.discarded, s.decks * 52);
  for (const seat of s.seats) {
    assert.ok(seat.hands.length >= 1 && seat.hands.length <= 2);
    for (const h of seat.hands) {
      assert.ok(h.cards.length >= 2);
      if (h.doubled) assert.equal(h.cards.length, 3);
      if (h.split && h.cards[0][0] === 'A' && seat.hands.every((x) => x.cards[0][0] === 'A'))
        assert.equal(h.cards.length, 2);
    }
  }
  if (s.phase === 'playing') {
    assert.ok(s.turn);
    assert.ok(!s.holeRevealed);
    assert.equal(s.dealer.length, 2);
  }
  if (s.phase === 'settled') {
    for (const seat of s.seats) for (const h of seat.hands) assert.ok(h.result);
    const live = s.seats.some((x) => x.hands.some((h) => h.result !== 'bust' && h.result !== 'blackjack'));
    if (live && !s.dealerBlackjack) assert.ok(bjHandValue(s.dealer).total >= 17);
    if (s.dealer.length > 2) assert.ok(bjHandValue(s.dealer.slice(0, -1)).total < 17);
  }
}

test('fuzz : 300 parties de robots jouées jusqu’au bout', () => {
  let rounds = 0;
  for (let g = 0; g < 300; g++) {
    const r = seeded(1000 + g);
    const n = 1 + (g % 7);
    let s = bjNewGame(
      {
        players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `R${i}`, bot: true })),
        stack: [500, 1000, 2000][g % 3],
      },
      r,
    );
    // Robots betting 5% would take very long to go broke; cap each game.
    for (let round = 0; round < 150 && !bjIsOver(s); round++) {
      if (s.phase === 'settled') s = bjNextRound(s);
      for (let steps = 0; s.phase !== 'settled'; steps++) {
        assert.ok(steps < 200, 'la manche ne se termine pas');
        const move = bjBotMove(s);
        if (move.type !== 'bet') assert.ok(bjLegalActions(s).includes(move.type));
        // Now and then play a random legal move instead, to reach odd spots.
        const legal = bjLegalActions(s);
        const chosen = move.type !== 'bet' && r(5) === 0 ? { type: legal[r(legal.length)] } : move;
        s = bjApply(s, chosen, r);
        checkInvariants(s);
      }
      rounds++;
    }
  }
  assert.ok(rounds > 10000);
});
