// Plays many whole online games with random legal moves (the way people would play them) and
// checks what a real table needs: the game never throws nor gets stuck, whoever must play always
// has a move, nobody sees another player's hidden cards, moves never change the state they were
// given, and the winners match the scores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE_GAMES, type OnlineGameId } from '../src/online.ts';
import type { Rng } from '../src/cards.ts';
import { bjLegalActions, bjMinBet, bjRanking } from '../src/blackjack.ts';
import { presidentCanPass, presidentLegalPlays, presidentStandings } from '../src/president.ts';
import { yamsLegalMoves, yamsRanking } from '../src/yams.ts';
import { beloteLegalMoves } from '../src/belote.ts';
import { p4LegalColumns } from '../src/puissance4.ts';
import { tarotEcartCandidates, tarotLegalMoves } from '../src/tarot.ts';
import { unoCanCatch, unoCanDraw, unoCanSay, unoColors, unoIsWild, unoLegalCards } from '../src/uno.ts';
import {
  PERUDO_DICE,
  perudoBidOptions,
  perudoCanCalza,
  perudoRanking,
  perudoTotalDice,
} from '../src/perudo.ts';
import {
  BN_FLEET,
  BN_SIZE,
  type BnShip,
  bnCanPlace,
  bnIsSunk,
  bnRandomFleet,
  bnShipCells,
  bnShotAt,
  bnSunkShips,
} from '../src/bataille.ts';
import { damesLegalMoves } from '../src/dames.ts';

function seeded(seed: number): Rng {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

function shuffled<T>(list: T[], rng: Rng): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Freezes a whole state, so a rule that changes the state it was given throws at once. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

const pick = <T>(list: T[], rng: Rng): T => list[rng(list.length)];

/** Moves a person could choose on their screen: legal ones, plus a few the rules should refuse. */
const CANDIDATES: Record<OnlineGameId, (state: any, seat: number, rng: Rng) => unknown[]> = {
  blackjack(s, seat, rng) {
    const p = s.players[seat];
    if (s.phase === 'betting') {
      const min = bjMinBet(p.stack);
      return [min, p.stack, min + rng(Math.max(1, p.stack - min + 1)), p.stack + 1, 0].map((amount) => ({
        type: 'bet',
        amount,
      }));
    }
    return [...bjLegalActions(s), 'split', 'double'].map((type) => ({ type }));
  },
  president(s, seat, rng) {
    const g = s.game;
    if (g.phase === 'exchange') {
      const hand = shuffled(g.players[seat].hand, rng);
      return [1, 2, 3].map((n) => ({ type: 'give', cards: hand.slice(0, n) }));
    }
    const plays = presidentLegalPlays(g, seat).map((cards) => ({ type: 'play', cards }));
    const all = [...plays, { type: 'play', cards: g.players[seat].hand.slice(0, 1) }];
    if (presidentCanPass(g, seat)) all.push({ type: 'pass' } as never);
    return all;
  },
  yams: (s) => [...yamsLegalMoves(s), { type: 'toggle', index: 7 }, { type: 'score', box: 'nope' }],
  belote: (s) => [...beloteLegalMoves(s), { type: 'play', card: 'Xx' }, { type: 'take' }],
  puissance4: (s) => [...p4LegalColumns(s.game), 7, -1].map((col) => ({ type: 'drop', col })),
  rami(s, seat, rng) {
    const hand: string[] = s.hands[seat];
    const out: unknown[] = [{ type: 'draw' }, { type: 'take' }];
    for (const card of hand) out.push({ type: 'discard', card });
    out.push({ type: 'meld', melds: [shuffled(hand, rng).slice(0, 3)] });
    s.melds.forEach((_: unknown, meld: number) => {
      out.push({ type: 'add', meld, cards: [pick(hand, rng)] });
      out.push({ type: 'swap', meld, card: pick(hand, rng) });
    });
    return out;
  },
  tarot(s, seat, rng) {
    if (s.phase === 'ecart') {
      const choice = shuffled(tarotEcartCandidates(s.hands[seat]), rng).slice(0, 6);
      return [
        { type: 'ecart', cards: choice },
        { type: 'ecart', cards: s.hands[seat].slice(0, 6) },
      ];
    }
    return [...tarotLegalMoves(s), { type: 'bid', bid: 'garde' }];
  },
  uno: unoCandidates,
  huit: unoCandidates,
  perudo(s, seat, rng) {
    const total = perudoTotalDice(s);
    const out: unknown[] = [{ type: 'dudo' }, { type: 'calza' }, { type: 'bid', quantity: 1, face: 1 }];
    for (const { face, min } of perudoBidOptions(s)) {
      out.push({ type: 'bid', quantity: min, face });
      out.push({ type: 'bid', quantity: min + rng(Math.max(1, total - min + 1)), face });
      out.push({ type: 'bid', quantity: min - 1, face }, { type: 'bid', quantity: total + 1, face });
    }
    return out;
  },
  bataille(s, seat, rng) {
    const g = s.game;
    if (g.phase === 'placement') {
      const fleet = handFleet(rng);
      const [first, ...rest] = fleet;
      const outside = first.horizontal ? { ...first, x: BN_SIZE - 1 } : { ...first, y: BN_SIZE - 1 };
      return [
        { type: 'place', ships: fleet },
        { type: 'place', ships: bnRandomFleet(rng) },
        { type: 'place', ships: rest },
        { type: 'place', ships: [...fleet, first] },
        { type: 'place', ships: [first, first, ...rest.slice(1)] },
        { type: 'place', ships: [outside, ...rest] },
        { type: 'place', ships: [{ ...first, size: 6 }, ...rest] },
        { type: 'shoot', x: 0, y: 0 },
      ];
    }
    const target = g.boards[1 - seat];
    const cells = Array.from({ length: BN_SIZE * BN_SIZE }, (_, i) => ({
      x: i % BN_SIZE,
      y: Math.floor(i / BN_SIZE),
    }));
    const free = shuffled(
      cells.filter((c) => !bnShotAt(target, c.x, c.y)),
      rng,
    );
    const out: unknown[] = free.slice(0, 4).map((c) => ({ type: 'shoot', ...c }));
    if (target.shots.length > 0) {
      const { x, y } = pick(target.shots as { x: number; y: number }[], rng);
      out.push({ type: 'shoot', x, y });
    }
    out.push({ type: 'shoot', x: BN_SIZE, y: 0 }, { type: 'place', ships: bnRandomFleet(rng) });
    return out;
  },
  dames(s) {
    const legal = damesLegalMoves(s.game).map((m) => ({ type: 'move', from: m.from, path: m.path }));
    const out: unknown[] = [...legal];
    // Stopping a capture halfway, or moving a square too far.
    for (const m of legal.slice(0, 2)) {
      if (m.path.length > 1) out.push({ ...m, path: m.path.slice(0, -1) });
      out.push({ ...m, path: [...m.path, m.path[m.path.length - 1]] });
    }
    out.push({ type: 'move', from: 0, path: [5] }, { type: 'move', from: 49, path: [44] });
    return out;
  },
};

/** A fleet laid out by hand on the placement screen: ships may touch, in any order. */
function handFleet(rng: Rng): BnShip[] {
  const ships: BnShip[] = [];
  for (const size of shuffled([...BN_FLEET], rng)) {
    for (;;) {
      const ship = { x: rng(BN_SIZE), y: rng(BN_SIZE), size, horizontal: rng(2) === 0 };
      if (bnCanPlace(ships, ship)) {
        ships.push(ship);
        break;
      }
    }
  }
  return ships;
}

/** Whether a fleet follows the rules, worked out here without the engine's own check. */
function fleetOk(ships: unknown): boolean {
  if (!Array.isArray(ships) || ships.length !== BN_FLEET.length) return false;
  const sizes = ships.map((s) => s?.size).sort((a, b) => b - a);
  if (sizes.some((n, i) => n !== BN_FLEET[i])) return false;
  const taken = new Set<number>();
  for (const ship of ships) {
    if (typeof ship.horizontal !== 'boolean') return false;
    for (const [x, y] of bnShipCells(ship)) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= BN_SIZE || y >= BN_SIZE)
        return false;
      if (taken.has(y * BN_SIZE + x)) return false;
      taken.add(y * BN_SIZE + x);
    }
  }
  return true;
}

/**
 * For the games whose rules are simple to state: whether a move must be accepted. Every
 * candidate is then tried, and the rules must accept exactly those.
 */
const LEGAL: Partial<Record<OnlineGameId, (state: any, seat: number, move: any) => boolean>> = {
  perudo(s, seat, m) {
    if (m.type === 'dudo') return s.bid !== null;
    if (m.type === 'calza') return perudoCanCalza(s, seat);
    const option = perudoBidOptions(s).find((o) => o.face === m.face);
    return !!option && m.quantity >= option.min && m.quantity <= perudoTotalDice(s);
  },
  bataille(s, seat, m) {
    const g = s.game;
    if (m.type === 'place') return g.phase === 'placement' && !g.boards[seat] && fleetOk(m.ships);
    const inside = m.x >= 0 && m.y >= 0 && m.x < BN_SIZE && m.y < BN_SIZE;
    return g.phase === 'tir' && seat === g.current && inside && !bnShotAt(g.boards[1 - seat], m.x, m.y);
  },
  dames: (s, seat, m) =>
    seat === s.game.current &&
    damesLegalMoves(s.game).some(
      (x) => x.from === m.from && x.path.length === m.path.length && x.path.every((v, i) => v === m.path[i]),
    ),
};

function unoCandidates(s: any, seat: number, rng: Rng): unknown[] {
  const g = s.game;
  const out: unknown[] = [];
  if (seat === g.current) {
    for (const card of unoLegalCards(g, seat)) {
      const color = unoIsWild(g.variant, card) ? pick([...unoColors(g.variant)], rng) : undefined;
      out.push({ type: 'play', card, color, say: g.players[seat].hand.length === 2 && rng(2) === 0 });
    }
    if (unoCanDraw(g, seat)) out.push({ type: 'draw' });
    if (g.drawn !== null) out.push({ type: 'pass' });
  }
  if (unoCanSay(g, seat)) out.push({ type: 'say' });
  if (g.exposed !== null && unoCanCatch(g, seat, g.exposed)) out.push({ type: 'catch', target: g.exposed });
  out.push({ type: 'play', card: g.players[(seat + 1) % g.players.length].hand[0] });
  return out;
}

/** Moves no rule accepts: each must be refused with a message, never crash nor go through. */
const GARBAGE: unknown[] = [
  null,
  42,
  'play',
  {},
  { type: 'nope' },
  { type: 'play' },
  { type: 'play', card: 5 },
  { type: 'play', cards: 'As' },
  { type: 'give', cards: [null] },
  { type: 'bet', amount: Number.NaN },
  { type: 'bet', amount: -10 },
  { type: 'bet', amount: 1e12 },
  { type: 'drop', col: 2.5 },
  { type: 'drop', col: '3' },
  { type: 'toggle', index: -1 },
  { type: 'score', box: 'constructor' },
  { type: 'score', box: '__proto__' },
  { type: 'meld', melds: [[]] },
  { type: 'add', meld: -1, cards: ['As1'] },
  { type: 'swap', meld: 99, card: 'As1' },
  { type: 'discard', card: 'Zz9' },
  { type: 'ecart', cards: [] },
  { type: 'bid', bid: 'toString' },
  { type: 'choose', suit: 'x' },
  { type: 'catch', target: 99 },
  { type: 'catch', target: -1 },
  { type: 'bid', quantity: 1e12, face: 3 },
  { type: 'bid', quantity: 2, face: 7 },
  { type: 'bid', quantity: 2.5, face: 3 },
  { type: 'bid', quantity: Number.NaN, face: 3 },
  { type: 'bid', quantity: '2', face: '3' },
  { type: 'shoot', x: 10, y: 0 },
  { type: 'shoot', x: -1, y: 0 },
  { type: 'shoot', x: 0.5, y: 0 },
  { type: 'shoot', x: Number.NaN, y: 0 },
  { type: 'shoot', x: '1', y: '1' },
  { type: 'place', ships: null },
  { type: 'place', ships: 'all' },
  { type: 'place', ships: [null, null, null, null, null] },
  { type: 'place', ships: BN_FLEET.map((size) => ({ x: 0, y: 0, size, horizontal: true })) },
  { type: 'place', ships: BN_FLEET.map((_, i) => ({ x: 0, y: i, size: 2 ** 32, horizontal: true })) },
  { type: 'place', ships: BN_FLEET.map((size, i) => ({ x: 0, y: i, size, horizontal: 'oui' })) },
];

/** Every card name in a value (cards are short strings: 'As', 'Ts1', 'r5a', '21t', 'EX'...). */
function cardsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => cardsIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => cardsIn(v, out));
  return out;
}

/** The hidden hands of a state, by seat, while a round is being played. */
const HANDS: Partial<Record<OnlineGameId, (state: any) => string[][]>> = {
  president: (s) => s.game.players.map((p: { hand: string[] }) => p.hand),
  belote: (s) => s.hands,
  rami: (s) => s.hands,
  tarot: (s) => s.hands,
  uno: (s) => s.game.players.map((p: { hand: string[] }) => p.hand),
  huit: (s) => s.game.players.map((p: { hand: string[] }) => p.hand),
};

/** Cards that are never shown to anyone but their owner (the stock, the draw pile, the shoe). */
const SECRET_PILES: Partial<Record<OnlineGameId, (state: any) => string[]>> = {
  belote: (s) => s.stock,
  rami: (s) => s.stock,
  uno: (s) => s.game.deck,
  huit: (s) => s.game.deck,
};

/**
 * Games with hidden information other than cards: checks one seat's view (null: a spectator)
 * against the whole state, while the game is played.
 */
const HIDDEN: Partial<Record<OnlineGameId, (state: any, view: any, seat: number | null) => void>> = {
  perudo(s, v, seat) {
    // Dice stay under the cups until a Dudo or a Calza shows them all.
    assert.equal(s.phase, 'bidding');
    assert.equal(s.challenge, null);
    v.players.forEach((p: { count: number; dice: number[] }, i: number) => {
      const real = s.players[i];
      assert.ok(real.count >= 0 && real.count <= PERUDO_DICE, `perudo : ${real.count} dés`);
      assert.equal(real.dice.length, real.count, 'perudo : pas autant de dés que de dés restants');
      assert.equal(p.count, real.count);
      if (i === seat) assert.deepEqual(p.dice, real.dice, 'perudo : on ne voit pas ses propres dés');
      else
        assert.ok(
          p.dice.length === real.count && p.dice.every((d) => d === 0),
          `perudo : la place ${seat} voit les dés de la place ${i}`,
        );
    });
    assert.deepEqual({ ...v, players: null }, { ...s, players: null });
  },
  bataille(s, v, seat) {
    const g = s.game;
    assert.deepEqual(v.placed, [!!g.boards[0], !!g.boards[1]]);
    for (const p of [0, 1]) {
      const real = g.boards[p];
      const seen = v.game.boards[p];
      if (!real) assert.equal(seen, null, 'bataille : une flotte pas encore placée est envoyée');
      else if (p === seat) assert.deepEqual(seen, real, 'bataille : on ne voit pas sa propre flotte');
      else {
        // Of the other fleet: every shot, and only the ships already sunk.
        assert.deepEqual(seen.shots, real.shots);
        assert.deepEqual(
          seen.ships,
          bnSunkShips(real),
          `bataille : la place ${seat} voit les bateaux de ${p}`,
        );
      }
    }
    assert.deepEqual({ ...v.game, boards: null }, { ...g, boards: null });
  },
};

/** Checks the winners against the final scores. */
function checkWinners(game: OnlineGameId, state: any, winners: number[], count: number) {
  assert.ok(winners.length >= 1, 'personne ne gagne');
  assert.ok(new Set(winners).size === winners.length, 'gagnant en double');
  assert.ok(
    winners.every((w) => Number.isInteger(w) && w >= 0 && w < count),
    `gagnant hors table ${winners}`,
  );
  const best = (scores: number[], high: boolean) => {
    const top = high ? Math.max(...scores) : Math.min(...scores);
    return scores.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
  };
  switch (game) {
    case 'blackjack': {
      const chips = state.players.map(
        (p: { id: string }) => bjRanking(state).find((r) => r.id === p.id)!.chips,
      );
      assert.deepEqual([...winners].sort(), best(chips, true));
      break;
    }
    case 'president': {
      const places = presidentStandings(state.game);
      assert.deepEqual(
        [...winners].sort(),
        places
          .filter((r) => r.place === 1)
          .map((r) => r.index)
          .sort(),
      );
      break;
    }
    case 'yams': {
      const totals = yamsRanking(state);
      const top = Math.max(...totals.map((r) => r.total));
      assert.deepEqual(
        [...winners].sort(),
        totals
          .filter((r) => r.total === top)
          .map((r) => state.players.findIndex((p: { id: string }) => p.id === r.id))
          .sort(),
      );
      break;
    }
    case 'belote':
      assert.equal(winners.length, 2);
      assert.ok(state.scores[winners[0] % 2] >= state.scores[1 - (winners[0] % 2)]);
      break;
    case 'puissance4':
      assert.deepEqual([...winners].sort(), best(state.game.scores, true));
      break;
    case 'rami':
      assert.deepEqual([...winners].sort(), best(state.scores, false));
      break;
    case 'tarot':
      assert.deepEqual([...winners].sort(), best(state.scores, true));
      break;
    case 'uno':
    case 'huit':
      assert.equal(winners.length, 1);
      if (state.game.target > 0) assert.ok(state.game.players[winners[0]].score >= state.game.target);
      break;
    case 'perudo': {
      // The last one with dice wins; the others went out one by one.
      assert.equal(winners.length, 1);
      state.players.forEach((p: { count: number }, i: number) => assert.equal(p.count > 0, i === winners[0]));
      assert.deepEqual(
        [...state.out].sort(),
        [...Array(count).keys()].filter((i) => i !== winners[0]),
      );
      assert.equal(perudoRanking(state)[0], winners[0]);
      break;
    }
    case 'bataille': {
      // The winner sank the whole other fleet, and still has a ship afloat; turns alternated.
      assert.equal(winners.length, 1);
      const w = winners[0];
      const lost = state.game.boards[1 - w];
      const kept = state.game.boards[w];
      assert.ok(lost.ships.every((ship: BnShip) => bnIsSunk(lost, ship)));
      assert.ok(!kept.ships.every((ship: BnShip) => bnIsSunk(kept, ship)));
      assert.equal(state.game.fired[w], lost.shots.length);
      assert.equal(state.game.fired[1 - w], kept.shots.length);
      assert.equal(state.game.fired[0] - state.game.fired[1], w === 0 ? 1 : 0);
      break;
    }
    case 'dames': {
      // A draw is shared; otherwise the loser has nothing left to play.
      const g = state.game;
      if (g.draw) assert.deepEqual([...winners].sort(), [0, 1]);
      else {
        assert.deepEqual(winners, [g.winner]);
        const loser = { ...g, winner: null, current: 1 - g.winner };
        assert.equal(damesLegalMoves(loser).length, 0);
      }
      break;
    }
  }
}

const SIZES: Record<OnlineGameId, number[]> = {
  blackjack: [1, 2, 3, 7],
  president: [3, 4, 5, 8],
  yams: [1, 2, 3, 6],
  belote: [4],
  puissance4: [2],
  rami: [2, 3, 6],
  tarot: [4],
  uno: [2, 3, 6],
  huit: [2, 3, 6],
  perudo: [2, 3, 4, 6],
  bataille: [2],
  dames: [2],
};

/** The shortest game each game offers, so many seeds stay quick. */
const OPTIONS: Record<OnlineGameId, Record<string, unknown>> = {
  blackjack: { stack: 500 },
  president: { rounds: 3 },
  yams: {},
  belote: { target: 501 },
  puissance4: { rounds: 3 },
  rami: { target: 150 },
  tarot: { deals: 4 },
  uno: { target: 200 },
  huit: { target: 100 },
  perudo: { calza: true },
  bataille: {},
  dames: {},
};

const SEEDS = Number(process.env.FUZZ_SEEDS ?? 12);

function play(game: OnlineGameId, count: number, seed: number) {
  const def = ONLINE_GAMES[game];
  const rng = seeded(seed);
  // Seat 0 is always a person; the others are people or robots at random.
  const seats = Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    name: `S${i}`,
    bot: i > 0 && rng(2) === 0,
  }));
  let state = deepFreeze(def.start(seats, def.options(OPTIONS[game]), rng));
  const owned = seats.map(() => new Set<string>());
  const shown = new Set<string>();
  let steps = 0;
  let rounds = 0;
  const limit = game === 'blackjack' ? 200_000 : 60_000;
  while (!def.over(state)) {
    assert.ok(++steps < limit, `${game} ${count} joueurs graine ${seed} : la partie ne finit pas`);
    if (def.betweenRounds(state)) {
      assert.deepEqual(def.actors(state), [], 'quelqu’un doit jouer entre deux manches');
      state = deepFreeze(def.nextRound(state, rng));
      rounds++;
      continue;
    }
    const actors = def.actors(state);
    assert.ok(actors.length > 0, `${game} : personne ne peut jouer (étape ${steps})`);
    assert.ok(
      actors.every((a) => a >= 0 && a < count),
      `${game} : joueur hors table ${actors}`,
    );
    // Whose turn it really is (told by a notification): one of those who may move.
    const toPlay = (def.toPlay ?? def.actors)(state);
    assert.ok(toPlay.length > 0 && toPlay.every((s) => actors.includes(s)), `${game} : tour de ${toPlay}`);

    // What everyone sees: no card from another hand or from a secret pile.
    const hands = HANDS[game]?.(state);
    const secret = new Set(SECRET_PILES[game]?.(state) ?? []);
    const pub = cardsIn(def.view(state, null));
    if (hands) {
      const inHands = new Set(hands.flat());
      for (const c of pub) if (!inHands.has(c) && !secret.has(c)) shown.add(c);
      hands.forEach((h, i) => h.forEach((c) => owned[i].add(c)));
      // The chien turned up for everyone, the cards a player handed over at Président.
      if (game === 'tarot')
        for (const c of (def.view(state, null) as { chien: string[] }).chien) shown.add(c);
      if (game === 'president')
        for (const e of state.game.exchanges) for (const c of e.cards) owned[e.from].add(c);
      for (let seat = -1; seat < count; seat++) {
        const seen = seat < 0 ? pub : cardsIn(def.view(state, seat));
        hands.forEach((h, i) => {
          if (i === seat) return;
          for (const c of h)
            assert.ok(
              !seen.has(c) || shown.has(c) || (seat >= 0 && owned[seat].has(c)),
              `${game} : la place ${seat} voit la carte ${c} de la place ${i}`,
            );
        });
      }
    }
    if (game === 'blackjack') {
      // Six decks: the same card is in the shoe and on the table, so only the shape is checked.
      for (let seat = -1; seat < count; seat++) {
        const view = def.view(state, seat < 0 ? null : seat) as { shoe?: unknown; dealer: string[] };
        assert.equal(view.shoe, undefined, 'le sabot est envoyé');
        if (!state.holeRevealed)
          assert.ok(view.dealer.length <= 1, 'la carte cachée du croupier est envoyée');
      }
    }
    const hidden = HIDDEN[game];
    if (hidden)
      for (let seat = -1; seat < count; seat++)
        hidden(state, def.view(state, seat < 0 ? null : seat), seat < 0 ? null : seat);
    for (let seat = -1; seat < count; seat++) {
      const seen = seat < 0 ? pub : cardsIn(def.view(state, seat));
      for (const c of secret) assert.ok(!seen.has(c), `${game} : la place ${seat} voit la carte cachée ${c}`);
    }

    const seat = pick(actors, rng);
    // Every move the server may play for this seat goes through.
    for (const a of actors) {
      const auto = def.auto(state, a, rng);
      assert.doesNotThrow(
        () => def.apply(state, a, auto, rng),
        `${game} : le coup automatique de la place ${a} est refusé (${JSON.stringify(auto)})`,
      );
    }
    // Moves no rule accepts are refused with a message.
    // (At the first step too, while fleets are being placed at the Bataille navale.)
    if (steps === 1 || steps % 7 === 0) {
      for (const bad of GARBAGE) {
        let refused = false;
        try {
          def.apply(state, seat, bad, rng);
        } catch (e) {
          refused = true;
          assert.ok(
            !(e instanceof TypeError) && !(e instanceof RangeError),
            `${game} : ${JSON.stringify(bad)} plante (${e})`,
          );
        }
        assert.ok(refused, `${game} : le coup ${JSON.stringify(bad)} est accepté`);
      }
    }
    let next: unknown = null;
    if (rng(4) > 0) {
      const legal = LEGAL[game];
      for (const move of shuffled(CANDIDATES[game](state, seat, rng), rng)) {
        let after: unknown = null;
        try {
          after = def.apply(state, seat, move, rng);
        } catch (e) {
          assert.ok(
            !(e instanceof TypeError) && !(e instanceof RangeError),
            `${game} : ${JSON.stringify(move)} plante (${e})`,
          );
        }
        if (legal)
          assert.equal(
            after !== null,
            legal(state, seat, move),
            `${game} : ${JSON.stringify(move)} ${after ? 'accepté' : 'refusé'} à tort`,
          );
        next ??= after;
        if (next && !legal) break;
      }
    }
    state = deepFreeze(next ?? def.apply(state, seat, def.auto(state, seat, rng), rng));
  }
  assert.deepEqual(def.actors(state), [], 'quelqu’un doit encore jouer une fois la partie finie');
  assert.equal(def.betweenRounds(state), false);
  checkWinners(game, state, def.winners(state), count);
  // Once the game is over, every hand may be shown, but the view must still work for everyone.
  for (let seat = -1; seat < count; seat++) def.view(state, seat < 0 ? null : seat);
  return { steps, rounds };
}

for (const game of Object.keys(ONLINE_GAMES) as OnlineGameId[]) {
  for (const count of SIZES[game]) {
    test(`${game} à ${count} : des parties entières au hasard se terminent sans erreur ni fuite`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) play(game, count, seed * 7919 + count);
    });
  }
}
