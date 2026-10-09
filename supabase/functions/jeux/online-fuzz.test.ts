// Whole online games played through the server rules, the way phones play them: each person
// chooses a move from their own view only (as the screen does), robots and slow players are
// played on timeouts, rounds are restarted by a tap or by the timer. Then a rematch is asked for
// and the new table starts. Checks that a move the screen offers is always accepted, that a
// person only ever receives their own cards, that experience is given once, to the right winners.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Rng } from '../_shared/engine/cards.ts';
import { ONLINE_GAMES, type OnlineGameId } from '../_shared/engine/online.ts';
import { bjLegalActions, bjMinBet } from '../_shared/engine/blackjack.ts';
import { presidentCanPass, presidentLegalPlays } from '../_shared/engine/president.ts';
import { yamsLegalMoves } from '../_shared/engine/yams.ts';
import { beloteLegalMoves } from '../_shared/engine/belote.ts';
import { p4LegalColumns } from '../_shared/engine/puissance4.ts';
import { tarotEcartCandidates, tarotLegalMoves } from '../_shared/engine/tarot.ts';
import {
  unoCanCatch,
  unoCanDraw,
  unoCanSay,
  unoColors,
  unoIsWild,
  unoLegalCards,
} from '../_shared/engine/uno.ts';
import { perudoBidOptions, perudoCanCalza, perudoTotalDice } from '../_shared/engine/perudo.ts';
import {
  BN_FLEET,
  BN_SIZE,
  type BnShip,
  bnCanPlace,
  bnRandomFleet,
  bnShotAt,
  bnSunkShips,
} from '../_shared/engine/bataille.ts';
import {
  type GameRoomRow,
  type GameSnapshot,
  type SeatedGamePlayerRow,
  cleanOptions,
  gameRematch,
  gameRematchJoin,
  humanActors,
  playGameMove,
  playGameTimeout,
  progressAwards,
  startGame,
} from './logic.ts';

function seeded(seed: number): Rng {
  let a = seed;
  return (max: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const pick = <T>(list: T[], rng: Rng): T => list[rng(list.length)];

function shuffled<T>(list: T[], rng: Rng): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The moves a screen offers a seat, worked out from that seat's own view only, as the screens do
 * with the engine's helpers. Each of them must be accepted by the server.
 */
const OFFERED: Record<OnlineGameId, (view: any, seat: number, rng: Rng) => unknown[]> = {
  blackjack(v, seat) {
    const p = v.players[seat];
    if (v.phase === 'betting')
      return [
        { type: 'bet', amount: bjMinBet(p.stack) },
        { type: 'bet', amount: p.stack },
      ];
    return bjLegalActions(v).map((type) => ({ type }));
  },
  president(v, seat, rng) {
    if (v.phase === 'exchange') {
      const give = v.pendingGives[0];
      if (!give || give.from !== seat) return [];
      return [{ type: 'give', cards: shuffled(v.players[seat].hand, rng).slice(0, give.count) }];
    }
    const out: unknown[] = presidentLegalPlays(v, seat).map((cards) => ({ type: 'play', cards }));
    if (presidentCanPass(v, seat)) out.push({ type: 'pass' });
    return out;
  },
  yams: (v) => yamsLegalMoves(v),
  belote: (v) => beloteLegalMoves(v),
  puissance4: (v) => p4LegalColumns(v.game).map((col) => ({ type: 'drop', col })),
  rami(v, seat) {
    if (v.phase === 'draw')
      return v.discard.length > 0 ? [{ type: 'draw' }, { type: 'take' }] : [{ type: 'draw' }];
    const hand: string[] = v.hands[seat];
    return hand.filter((c) => c !== v.taken || hand.length === 1).map((card) => ({ type: 'discard', card }));
  },
  tarot(v, seat, rng) {
    if (v.phase === 'ecart')
      return [{ type: 'ecart', cards: shuffled(tarotEcartCandidates(v.hands[seat]), rng).slice(0, 6) }];
    return tarotLegalMoves(v);
  },
  uno: unoOffered,
  huit: unoOffered,
  perudo(v, seat, rng) {
    if (v.phase !== 'bidding' || v.current !== seat) return [];
    const total = perudoTotalDice(v);
    const out: unknown[] = perudoBidOptions(v).map(({ face, min }) => ({
      type: 'bid',
      quantity: min + rng(total - min + 1),
      face,
    }));
    if (v.bid) out.push({ type: 'dudo' });
    if (perudoCanCalza(v, seat)) out.push({ type: 'calza' });
    return out;
  },
  bataille(v, seat, rng) {
    const g = v.game;
    if (g.phase === 'placement')
      return v.placed[seat] ? [] : [{ type: 'place', ships: rng(2) ? bnRandomFleet(rng) : handFleet(rng) }];
    if (g.current !== seat) return [];
    // The cells of the other grid not fired at yet, as the screen shows them.
    const target = g.boards[1 - seat];
    const out: unknown[] = [];
    for (let y = 0; y < BN_SIZE; y++)
      for (let x = 0; x < BN_SIZE; x++) if (!bnShotAt(target, x, y)) out.push({ type: 'shoot', x, y });
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

function unoOffered(v: any, seat: number, rng: Rng): unknown[] {
  const out: unknown[] = [];
  if (seat === v.current) {
    for (const card of unoLegalCards(v, seat)) {
      const color = unoIsWild(v.variant, card) ? pick([...unoColors(v.variant)], rng) : undefined;
      out.push({ type: 'play', card, color, say: v.players[seat].hand.length === 2 || undefined });
    }
    if (unoCanDraw(v, seat)) out.push({ type: 'draw' });
    if (v.drawn !== null) out.push({ type: 'pass' });
  }
  if (unoCanSay(v, seat)) out.push({ type: 'say' });
  if (v.exposed !== null && unoCanCatch(v, seat, v.exposed)) out.push({ type: 'catch', target: v.exposed });
  return out;
}

/** Cards a seat holds that nobody else may see while the round is played. */
const HANDS: Partial<Record<OnlineGameId, (state: any) => string[][]>> = {
  president: (s) => s.game.players.map((p: { hand: string[] }) => p.hand),
  belote: (s) => s.hands,
  rami: (s) => s.hands,
  tarot: (s) => s.hands,
  uno: (s) => s.game.players.map((p: { hand: string[] }) => p.hand),
  huit: (s) => s.game.players.map((p: { hand: string[] }) => p.hand),
};

/**
 * Games with hidden information other than cards: checks what a seat receives (null: the
 * public view) against the whole state, while the game is played.
 */
const HIDDEN: Partial<Record<OnlineGameId, (state: any, view: any, seat: number | null) => void>> = {
  perudo(s, v, seat) {
    // The others' dice stay under their cups until a Dudo or a Calza shows them all.
    if (s.phase !== 'bidding') return;
    v.players.forEach((p: { count: number; dice: number[] }, i: number) => {
      const real = s.players[i];
      assert.equal(p.count, real.count);
      if (i === seat) assert.deepEqual(p.dice, real.dice);
      else
        assert.ok(
          p.dice.length === real.count && p.dice.every((d) => d === 0),
          `perudo : la place ${seat} voit les dés de la place ${i}`,
        );
    });
  },
  bataille(s, v, seat) {
    // Of the other fleet, only the shots and the sunk ships until the end.
    const g = s.game;
    assert.deepEqual(v.placed, [!!g.boards[0], !!g.boards[1]]);
    for (const p of [0, 1]) {
      const real = g.boards[p];
      const seen = v.game.boards[p];
      if (!real) assert.equal(seen, null);
      else if (p === seat) assert.deepEqual(seen, real);
      else {
        assert.deepEqual(seen.shots, real.shots);
        assert.deepEqual(
          seen.ships,
          bnSunkShips(real),
          `bataille : la place ${seat} voit les bateaux de ${p}`,
        );
      }
    }
  },
};

const OPTIONS: Record<OnlineGameId, Record<string, unknown>> = {
  blackjack: { stack: 500 },
  president: { rounds: 2 },
  yams: {},
  belote: { target: 501 },
  puissance4: { rounds: 3 },
  rami: { target: 150 },
  tarot: { deals: 4 },
  uno: { target: 0 },
  huit: { target: 0 },
  perudo: {},
  bataille: {},
};

/** Tables to try: how many people, and how many robots the host added. */
const TABLES: Record<OnlineGameId, [number, number][]> = {
  blackjack: [
    [1, 0],
    [2, 1],
    [3, 4],
  ],
  president: [
    [1, 0],
    [3, 0],
    [2, 3],
    [8, 0],
  ],
  yams: [
    [1, 0],
    [2, 0],
    [3, 3],
  ],
  belote: [
    [1, 0],
    [2, 0],
    [4, 0],
  ],
  puissance4: [
    [1, 0],
    [2, 0],
  ],
  rami: [
    [1, 0],
    [2, 1],
    [6, 0],
  ],
  tarot: [
    [1, 0],
    [3, 0],
    [4, 0],
  ],
  uno: [
    [1, 0],
    [3, 0],
    [2, 4],
  ],
  huit: [
    [1, 0],
    [2, 0],
    [6, 0],
  ],
  perudo: [
    [1, 0],
    [2, 0],
    [3, 2],
    [6, 0],
  ],
  bataille: [
    [1, 0],
    [2, 0],
  ],
};

function cardsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => cardsIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => cardsIn(v, out));
  return out;
}

function playTable(game: OnlineGameId, people: number, robots: number, seed: number) {
  const rng = seeded(seed);
  let now = 1_000_000;
  let botIds = 0;
  const room: GameRoomRow = {
    id: 'room',
    code: 'ABCDEF',
    game,
    host_id: 'h0',
    options: cleanOptions(game, OPTIONS[game]),
    status: 'lobby',
    version: 0,
  };
  const players: SeatedGamePlayerRow[] = [];
  for (let i = 0; i < people; i++)
    players.push({
      user_id: `h${i}`,
      name: `Joueur ${i}`,
      seat: i,
      is_bot: false,
      avatar: null,
      avatar_color: null,
    });
  for (let i = 0; i < robots; i++)
    players.push({
      user_id: `r${i}`,
      name: `Robot ${i}`,
      seat: people + i,
      is_bot: true,
      avatar: '🤖',
      avatar_color: null,
    });
  const started = startGame(room, players, 'h0', () => `auto${++botIds}`, rng, now);
  for (const b of started.bots) players.push({ ...b });
  let s: GameSnapshot = started.snapshot;
  const humans = s.secret.seats.map((x, i) => ({ ...x, seat: i })).filter((x) => !x.bot);
  assert.deepEqual(Object.keys(s.privates).sort(), humans.map((h) => h.id).sort());

  const finishedFor = new Map<string, boolean>();
  for (let steps = 0; !s.public.over; steps++) {
    assert.ok(steps < 40_000, `${game} : la partie ne finit pas`);
    const pub = s.public;
    // Checks on what reaches the phones.
    assert.deepEqual(Object.keys(s.privates).sort(), humans.map((h) => h.id).sort());
    assert.ok(pub.deadline !== null, `${game} : plus de chrono, la table est bloquée`);
    assert.ok(pub.actors.every((id) => s.secret.seats.some((x) => x.id === id)));
    if (pub.betweenRounds) assert.deepEqual(pub.actors, []);
    else assert.ok(pub.actors.length > 0, `${game} : personne ne peut jouer`);
    // A phone receives nothing more than the table shows everyone, apart from its own hand.
    const hands = HANDS[game]?.(s.secret.state);
    if (hands && !pub.betweenRounds) {
      const table = cardsIn(pub.view);
      const exchanged = new Set<string>(
        game === 'president'
          ? s.secret.state.game.exchanges.flatMap((e: { cards: string[] }) => e.cards)
          : [],
      );
      for (const h of humans) {
        const mine = new Set(hands[h.seat]);
        for (const c of cardsIn(s.privates[h.id]))
          if (hands.some((other, i) => i !== h.seat && other.includes(c)))
            assert.ok(
              table.has(c) || mine.has(c) || exchanged.has(c),
              `${game} : ${h.id} voit la carte ${c} d’un autre`,
            );
      }
    }
    const hidden = HIDDEN[game];
    if (hidden && !pub.over) {
      hidden(s.secret.state, pub.view, null);
      for (const h of humans) hidden(s.secret.state, s.privates[h.id], h.seat);
    }
    assert.equal(JSON.stringify(pub).includes('"deck":["'), false, `${game} : la pioche est envoyée`);
    assert.equal(JSON.stringify(pub).includes('"shoe"'), false, `${game} : le sabot est envoyé`);
    assert.equal(JSON.stringify(pub).includes('"stock":'), false, `${game} : le talon est envoyé`);

    let next: GameSnapshot | null = null;
    const humanTurn = pub.actors.filter((id) => humans.some((h) => h.id === id));
    if (pub.betweenRounds) {
      if (rng(2) === 0) next = playGameMove(s.secret, pick(humans, rng).id, { type: 'next' }, rng, now);
    } else if (humanTurn.length > 0 && rng(5) > 0) {
      const id = pick(humanTurn, rng);
      const who = humans.find((h) => h.id === id)!;
      const offered = OFFERED[game](s.privates[who.id], who.seat, rng);
      if (offered.length > 0) {
        const move = pick(offered, rng);
        try {
          next = playGameMove(s.secret, who.id, move, rng, now);
        } catch (e) {
          assert.fail(
            `${game} : l’écran propose ${JSON.stringify(move)} mais le serveur refuse : ${(e as Error).message}`,
          );
        }
      } else {
        assert.ok(
          pub.actors[0] !== who.id || game === 'uno' || game === 'huit',
          `${game} : c’est au tour de ${who.id} mais son écran ne propose rien`,
        );
      }
    }
    if (!next) {
      now = s.secret.deadline!;
      next = playGameTimeout(s.secret, rng, now);
    }
    // Experience: once per person at the end, with the bonus for the winners only.
    for (const a of progressAwards(s.secret, next)) {
      if (!a.finished) continue;
      assert.ok(!finishedFor.has(a.userId), 'deux fois la fin de partie');
      finishedFor.set(a.userId, a.finished.won);
    }
    humanActors(next.secret);
    s = next;
  }
  const def = ONLINE_GAMES[game];
  const winners = new Set(def.winners(s.secret.state).map((i) => s.secret.seats[i].id));
  assert.ok(winners.size > 0);
  assert.deepEqual(
    [...finishedFor.keys()].sort(),
    humans.map((h) => h.id).sort(),
    `${game} : tout le monde n’a pas son expérience de fin de partie`,
  );
  for (const [id, won] of finishedFor) assert.equal(won, winners.has(id));
  assert.deepEqual(s.public.actors, []);
  assert.throws(() => playGameMove(s.secret, humans[0].id, { type: 'next' }, rng, now), /finie/);

  // Rematch: one person asks, the others follow, and the host starts the new table.
  const finished = { ...room, status: 'playing' as const };
  const asker = pick(humans, rng);
  const plan = gameRematch(finished, s.secret, players, asker.id);
  const rematchRoom: GameRoomRow = {
    ...room,
    id: 'room2',
    code: 'GHJKLM',
    host_id: asker.id,
    options: plan.room.options,
  };
  const seated = plan.players.map((p) => ({ ...p }));
  for (const h of shuffled(humans, rng)) {
    const row = gameRematchJoin(rematchRoom, seated, players, h.id);
    if (h.id === asker.id) assert.equal(row, null);
    else {
      assert.ok(row, `${h.id} ne peut pas rejoindre la revanche`);
      seated.push(row);
    }
  }
  assert.equal(new Set(seated.map((p) => p.seat)).size, seated.length, 'deux joueurs à la même place');
  assert.equal(seated.length, s.secret.seats.length);
  const again = startGame(rematchRoom, seated, asker.id, () => `again${++botIds}`, rng, now);
  assert.equal(again.bots.length, 0, 'la revanche ajoute des robots en plus');
  assert.deepEqual(
    again.snapshot.public.seats.map((x) => x.id),
    s.secret.seats.map((x) => x.id),
    'les places de la revanche ne sont plus les mêmes',
  );
}

const SEEDS = Number(process.env.FUZZ_SEEDS ?? 4);

for (const game of Object.keys(ONLINE_GAMES) as OnlineGameId[]) {
  for (const [people, robots] of TABLES[game]) {
    test(`serveur ${game}, ${people} personne(s) et ${robots} robot(s) : partie entière puis revanche`, () => {
      for (let seed = 1; seed <= SEEDS; seed++)
        playTable(game, people, robots, seed * 104729 + people * 10 + robots);
    });
  }
}
