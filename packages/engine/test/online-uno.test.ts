import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE_GAMES } from '../src/online.ts';
import type { OnlineSeat } from '../src/online.ts';
import { UNO_HIDDEN, type UnoOnlineState, type UnoView, unoOnline, unoView } from '../src/online-uno.ts';
import { type UnoState, unoLegalCards } from '../src/uno.ts';

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

const seats = (bots: boolean[]): OnlineSeat[] => bots.map((bot, i) => ({ id: `s${i}`, name: `S${i}`, bot }));

const uno = unoOnline('uno');
const huit = unoOnline('huit');

/** Plays the first actor's automatic move until the round is over. */
function playRound(game: typeof uno, state: UnoOnlineState, rng: ReturnType<typeof seeded>) {
  let s = state;
  for (let guard = 0; game.actors(s).length > 0; guard++) {
    assert.ok(guard < 3000, 'la manche ne finit pas');
    const [seat] = game.actors(s);
    s = game.apply(s, seat, game.auto(s, seat, rng), rng);
  }
  return s;
}

test('both variants are registered, for 2 to 6 seats with robots filling up to 2', () => {
  assert.equal(typeof ONLINE_GAMES.uno.start, 'function');
  assert.equal(typeof ONLINE_GAMES.huit.start, 'function');
  for (const g of [uno, huit]) {
    assert.equal(g.minPlayers, 1);
    assert.equal(g.maxPlayers, 6);
    assert.equal(g.fillTo, 2);
  }
  assert.throws(() => uno.start(seats([false]), {}, seeded(1)), /de 2 à 6/);
  assert.throws(() => uno.start(seats(Array(7).fill(false)), {}, seeded(1)), /de 2 à 6/);
});

test('options: the target must be one the variant offers', () => {
  assert.deepEqual(uno.options({}), { target: 200 });
  assert.deepEqual(huit.options({}), { target: 100 });
  assert.deepEqual(uno.options({ target: 0 }), { target: 0 });
  assert.deepEqual(uno.options({ target: 500 }), { target: 500 });
  assert.throws(() => uno.options({ target: 100 }), /Durée/);
  assert.throws(() => huit.options({ target: 500 }), /Durée/);
  assert.throws(() => uno.options({ target: '200' }), /Durée/);
  const s = huit.start(seats([false, true, true]), huit.options({ target: 200 }), seeded(2));
  assert.equal(s.game.variant, 'huit');
  assert.equal(s.game.target, 200);
  assert.deepEqual(s.bots, [false, true, true]);
});

test('only the player whose turn it is may move, with checked moves', () => {
  const rng = seeded(3);
  const s = uno.start(seats([false, false, false]), {}, rng);
  assert.deepEqual(uno.actors(s), [s.game.current]);
  const seat = s.game.current;
  const other = (seat + 1) % 3;
  assert.throws(() => uno.apply(s, other, { type: 'draw' }, rng), /pas ton tour/);
  for (const bad of [
    null,
    'draw',
    3,
    {},
    { type: 'cheat' },
    { type: 'play' },
    { type: 'catch', target: 'x' },
  ])
    assert.throws(() => uno.apply(s, seat, bad, rng), Error);
  assert.throws(
    () => uno.apply(s, seat, { type: 'play', card: s.game.players[other].hand[0] }, rng),
    /ne va pas/,
  );
  assert.throws(() => uno.auto(s, other, rng), /pas son tour/);
  const next = uno.apply(s, seat, { type: 'draw', extra: 1 }, rng);
  assert.equal(next.game.seq, 1);
});

/** A game where seat 0 is about to play their second to last card. */
function almostOut(bots: boolean[]): UnoOnlineState {
  const base = uno.start(seats(bots), { target: 0 }, seeded(4));
  const g: UnoState = {
    ...base.game,
    current: 0,
    direction: 1,
    color: 'r',
    discard: ['r5a'],
    players: base.game.players.map((p, i) =>
      i === 0 ? { ...p, hand: ['r3a', 'g7a'] } : { ...p, hand: ['b1a', 'b2a', 'b3a', 'b4a'] },
    ),
  };
  return { ...base, game: g };
}

test('forgetting the announcement lets the other people catch you', () => {
  const rng = seeded(5);
  const s = almostOut([false, false, true]);
  const after = uno.apply(s, 0, { type: 'play', card: 'r3a' }, rng);
  assert.equal(after.game.exposed, 0);
  // Player 1 has the turn; I may announce, player 1 may catch; the robot waits for its turn.
  assert.deepEqual(uno.actors(after), [1, 0]);
  const said = uno.apply(after, 0, { type: 'say' }, rng);
  assert.equal(said.game.exposed, null);
  assert.deepEqual(uno.actors(said), [1]);
  const caught = uno.apply(after, 1, { type: 'catch', target: 0 }, rng);
  assert.equal(caught.game.players[0].hand.length, 3);
  // A non-current person's automatic move is the announcement or the catch.
  assert.deepEqual(uno.auto(after, 0, rng), { type: 'say' });
  // Announcing with the card: nobody can catch.
  const ok = uno.apply(s, 0, { type: 'play', card: 'r3a', say: true }, rng);
  assert.equal(ok.game.exposed, null);
  assert.deepEqual(uno.actors(ok), [1]);
});

test('a robot on its turn may catch whoever forgot', () => {
  const s = almostOut([false, true, true]);
  const after = uno.apply(s, 0, { type: 'play', card: 'r3a' }, seeded(6));
  // The robot whose turn it is, and me to announce.
  assert.deepEqual(uno.actors(after), [1, 0]);
  let caught = 0;
  for (let seed = 0; seed < 40; seed++) {
    const move = uno.auto(after, 1, seeded(seed)) as { type: string };
    if (move.type === 'catch') caught++;
    else assert.notEqual(move.type, 'say');
  }
  assert.ok(caught > 10 && caught < 40, `${caught}`);
});

test('a view never shows the draw pile nor the cards of the others', () => {
  const rng = seeded(7);
  for (const game of [uno, huit]) {
    let s = game.start(seats([false, false, true, true]), {}, rng);
    for (let step = 0; step < 60 && game.actors(s).length; step++) {
      for (const seat of [0, 1, 2, 3, null]) {
        const v = game.view(s, seat) as UnoView;
        const json = JSON.stringify(v);
        assert.deepEqual(v.deck, []);
        assert.equal(v.deckCount, s.game.deck.length);
        assert.deepEqual(v.bots, s.bots);
        s.game.players.forEach((p, i) => {
          assert.equal(v.players[i].hand.length, p.hand.length);
          if (i === seat) assert.deepEqual(v.players[i].hand, p.hand);
          else assert.ok(v.players[i].hand.every((c) => c === UNO_HIDDEN));
        });
        const visible = new Set([...(seat === null ? [] : s.game.players[seat].hand), ...s.game.discard]);
        const hidden = [...s.game.players.flatMap((p) => p.hand), ...s.game.deck].filter(
          (c) => !visible.has(c),
        );
        for (const c of hidden) assert.ok(!json.includes(`"${c}"`), `${c} visible par ${seat}`);
        if (seat !== null && seat === s.game.current) assert.equal(v.drawn, s.game.drawn);
        // My legal cards can be worked out from my view alone.
        if (seat !== null) assert.deepEqual(unoLegalCards(v, seat), unoLegalCards(s.game, seat));
      }
      const [seat] = game.actors(s);
      s = game.apply(s, seat, game.auto(s, seat, rng), rng);
    }
  }
});

test('hands are shown to everyone once a round is over', () => {
  const rng = seeded(8);
  const s = playRound(uno, uno.start(seats([true, true, true]), { target: 500 }, rng), rng);
  assert.equal(uno.betweenRounds(s), true);
  const v = unoView(s, null);
  assert.deepEqual(
    v.players.map((p) => p.hand),
    s.game.players.map((p) => p.hand),
  );
});

test('auto always gives a move apply accepts, through whole games of both variants', () => {
  for (const game of [uno, huit])
    for (const seed of [1, 2, 3]) {
      const rng = seeded(seed);
      const count = 2 + seed;
      let s = game.start(seats(Array.from({ length: count }, (_, i) => i > 0)), game.options({}), rng);
      let rounds = 0;
      while (!game.over(s)) {
        s = playRound(game, s, rng);
        rounds++;
        assert.ok(rounds < 50, 'la partie ne finit pas');
        if (game.betweenRounds(s)) s = game.nextRound(JSON.parse(JSON.stringify(s)), rng);
      }
      assert.deepEqual(game.actors(s), []);
      const winners = game.winners(s);
      assert.equal(winners.length, 1);
      assert.ok(s.game.players[winners[0]].score >= s.game.target);
      assert.throws(() => game.apply(s, 0, { type: 'draw' }, rng), /finie/);
    }
});

test('a single round ends the game at once', () => {
  const rng = seeded(9);
  const s = playRound(huit, huit.start(seats([false, true]), { target: 0 }, rng), rng);
  assert.equal(huit.over(s), true);
  assert.equal(huit.betweenRounds(s), false);
  assert.deepEqual(huit.winners(s), [s.game.roundWinner]);
});
