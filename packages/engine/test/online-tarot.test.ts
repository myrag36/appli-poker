import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type TarotState,
  type TarotView,
  tarotBotEcart,
  tarotIsTrump,
  tarotLegalCards,
  tarotNewDeck,
} from '../src/tarot.ts';
import { tarotOnline as game } from '../src/online-tarot.ts';
import { ONLINE_GAMES, type OnlineSeat, isOnlineGame } from '../src/online.ts';

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

const seats: OnlineSeat[] = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id.toUpperCase(), bot: i > 0 }));

/** A game whose first deal is not cancelled by a Petit sec. */
function startPlayable(seed: number, options: Record<string, unknown> = {}) {
  const rng = seeded(seed);
  let s = game.start(seats, options, rng);
  while (game.betweenRounds(s)) s = game.nextRound(s, rng);
  return { s, rng };
}

/** Bids for each seat in turn: the given bid for the first one, then passes. */
function bid(s: TarotState, first: string, rng: ReturnType<typeof seeded>): TarotState {
  let next = game.apply(s, game.actors(s)[0], { type: 'bid', bid: first }, rng);
  while (next.phase === 'bidding')
    next = game.apply(next, game.actors(next)[0], { type: 'bid', bid: 'pass' }, rng);
  return next;
}

function playDeal(state: TarotState, rng: ReturnType<typeof seeded>): TarotState {
  let s = state;
  for (let guard = 0; game.actors(s).length > 0; guard++) {
    assert.ok(guard < 200, 'la donne ne finit pas');
    const [seat] = game.actors(s);
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
  }
  return s;
}

test('tarot is registered as an online game', () => {
  assert.ok(isOnlineGame('tarot'));
  assert.equal(ONLINE_GAMES.tarot, game);
});

test('options: 4 deals by default, 4 or 8 only', () => {
  assert.deepEqual(game.options({}), { deals: 4 });
  assert.deepEqual(game.options({ deals: 8 }), { deals: 8 });
  assert.throws(() => game.options({ deals: 5 }), /4 ou 8/);
  assert.throws(() => game.options({ deals: '8' }), /4 ou 8/);
});

test('robots complete the table up to four seats', () => {
  assert.equal(game.minPlayers, 1);
  assert.equal(game.maxPlayers, 4);
  assert.equal(game.fillTo, 4);
  assert.throws(() => game.start(seats.slice(0, 3), {}, seeded(1)), /à 4/);
});

test('start deals 18 cards each and a chien of 6, then waits for the player after the dealer', () => {
  const { s } = startPlayable(1, { deals: 8 });
  assert.equal(s.deals, 8);
  assert.equal(s.phase, 'bidding');
  assert.ok(s.hands.every((h) => h.length === 18));
  assert.equal(s.chien.length, 6);
  assert.deepEqual(game.actors(s), [(s.dealer + 1) % 4]);
  assert.equal(game.over(s), false);
});

test('moves from the wrong seat or with a bad shape are refused', () => {
  const { s, rng } = startPlayable(2);
  const [seat] = game.actors(s);
  const other = (seat + 1) % 4;
  assert.throws(() => game.apply(s, other, { type: 'bid', bid: 'pass' }, rng), /pas ton tour/);
  for (const bad of [null, 'pass', 42, {}, { type: 'cheat' }, { type: 'bid' }, { type: 'bid', bid: 'all' }])
    assert.throws(() => game.apply(s, seat, bad, rng), Error);
  assert.throws(() => game.apply(s, seat, { type: 'play', card: s.hands[seat][0] }, rng), /enchères/);
  assert.throws(() => game.apply(s, seat, { type: 'ecart', cards: 'all' }, rng), /6 cartes/);
  assert.throws(() => game.auto(s, other, rng), /pas son tour/);

  // A bid must be higher than the best one so far.
  const garde = game.apply(s, seat, { type: 'bid', bid: 'garde' }, rng);
  assert.throws(() => game.apply(garde, other, { type: 'bid', bid: 'petite' }, rng), /plus haut/);
  assert.throws(() => game.apply(garde, other, { type: 'bid', bid: 'garde' }, rng), /plus haut/);
});

test('the écart is checked, then play follows the rules', () => {
  const { s: start, rng } = startPlayable(3);
  const s = bid(start, 'garde', rng);
  assert.equal(s.phase, 'ecart');
  const taker = s.taker!;
  assert.deepEqual(game.actors(s), [taker]);
  assert.equal(s.hands[taker].length, 24);
  assert.throws(() => game.apply(s, taker, { type: 'play', card: s.hands[taker][0] }, rng), /écart/);
  assert.throws(
    () => game.apply(s, taker, { type: 'ecart', cards: s.hands[taker].slice(0, 5) }, rng),
    /6 cartes/,
  );
  assert.throws(
    () => game.apply(s, taker, { type: 'ecart', cards: s.hands[(taker + 1) % 4].slice(0, 6) }, rng),
    /pas ces cartes/,
  );
  const played = game.apply(s, taker, { type: 'ecart', cards: tarotBotEcart(s.hands[taker]) }, rng);
  assert.equal(played.phase, 'playing');
  assert.equal(played.hands[taker].length, 18);
  const [first] = game.actors(played);
  assert.throws(() => game.apply(played, first, { type: 'play', card: 'Xx' }, rng), /pas cette carte/);
  const next = game.apply(played, first, { type: 'play', card: played.hands[first][0] }, rng);
  const [second] = game.actors(next);
  const legal = tarotLegalCards(next.hands[second], next.trick);
  const illegal = next.hands[second].find((c) => !legal.includes(c));
  if (illegal)
    assert.throws(() => game.apply(next, second, { type: 'play', card: illegal }, rng), /pas permise/);
});

test('when everyone passes the deal is redealt by the next dealer', () => {
  const { s: start, rng } = startPlayable(4);
  const s = bid(start, 'pass', rng);
  assert.equal(game.betweenRounds(s), true);
  assert.deepEqual(game.actors(s), []);
  assert.throws(() => game.apply(s, 0, { type: 'bid', bid: 'pass' }, rng), /Personne/);
  const next = game.nextRound(s, rng);
  assert.equal(next.dealer, (s.dealer + 1) % 4);
  assert.equal(next.dealNumber, s.dealNumber);
});

test('auto always gives a move apply accepts, through whole games', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const rng = seeded(seed);
    let s = game.start(seats, { deals: 4 }, rng);
    let rounds = 0;
    while (!game.over(s)) {
      s = playDeal(s, rng);
      rounds++;
      assert.ok(rounds < 60, 'la partie ne finit pas');
      if (game.betweenRounds(s)) s = game.nextRound(s, rng);
    }
    assert.equal(game.betweenRounds(s), false);
    assert.deepEqual(game.actors(s), []);
    assert.equal(
      s.scores.reduce((a, b) => a + b, 0),
      0,
    );
    const best = Math.max(...s.scores);
    assert.deepEqual(
      game.winners(s),
      [0, 1, 2, 3].filter((p) => s.scores[p] === best),
    );
  }
});

/** No card the seat could not see at a real table appears anywhere in its view. */
function checkView(state: TarotState) {
  const ended = state.phase === 'dealOver' || state.phase === 'gameOver';
  const chienUp = ended || state.contract === 'petite' || state.contract === 'garde';
  for (const seat of [0, 1, 2, 3, null]) {
    const v = game.view(state, seat) as TarotView;
    const json = JSON.stringify(v);
    assert.ok(!('won' in v));
    assert.deepEqual(
      v.handCounts,
      state.hands.map((h) => h.length),
    );
    state.hands.forEach((hand, i) => assert.deepEqual(v.hands[i], i === seat ? hand : []));
    assert.deepEqual(v.chien, chienUp ? state.chien : []);
    const visible = new Set<string>([
      ...(seat === null ? [] : state.hands[seat]),
      ...state.trick.map((p) => p.card),
      ...state.tricks.flatMap((t) => t.cards.map((p) => p.card)),
      ...(chienUp ? state.chien : []),
      ...(ended || seat === state.taker ? state.ecart : state.ecart.filter(tarotIsTrump)),
    ]);
    for (const c of tarotNewDeck())
      if (!visible.has(c)) assert.ok(!json.includes(`"${c}"`), `${c} visible par ${seat}`);
  }
}

test('a view shows my hand only, the chien once turned up, and the écart to the taker', () => {
  for (const contract of ['petite', 'garde', 'gardeSans', 'gardeContre']) {
    const { s: start, rng } = startPlayable(6);
    checkView(start);
    let s = bid(start, contract, rng);
    for (let i = 0; game.actors(s).length > 0; i++) {
      checkView(s);
      const [seat] = game.actors(s);
      s = game.apply(s, seat, game.auto(s, seat, rng), rng);
    }
    checkView(s);
    // At the end of the deal everything is turned up.
    const v = game.view(s, null) as TarotView;
    assert.equal(v.chien.length, 6);
    if (contract === 'petite' || contract === 'garde') assert.equal(v.ecart.length, 6);
  }
});

test('the state survives a JSON round trip', () => {
  const rng = seeded(7);
  let s = game.start(seats, {}, rng);
  for (let i = 0; i < 120 && !game.over(s); i++) {
    s = JSON.parse(JSON.stringify(s));
    if (game.betweenRounds(s)) {
      s = game.nextRound(s, rng);
      continue;
    }
    const [seat] = game.actors(s);
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
