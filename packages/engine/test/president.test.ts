import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type PresidentState,
  presidentApply,
  presidentBotMove,
  presidentCanPass,
  presidentCanPlay,
  presidentLegalPlays,
  presidentNewGame,
  presidentNextRound,
  presidentPoints,
  presidentRank,
  presidentSort,
  presidentStandings,
  presidentTitles,
} from '../src/president.ts';

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

/** A round in progress with chosen hands; by default past the first play of the game. */
function make(hands: string[][], toAct = 0, extra: Partial<PresidentState> = {}): PresidentState {
  const base = presidentNewGame(names(hands.length), seeded(1));
  return {
    ...base,
    players: base.players.map((p, i) => ({ ...p, hand: presidentSort(hands[i]) })),
    toAct,
    played: ['3c'],
    ...extra,
  };
}

const play = (cards: string[]) => ({ type: 'play' as const, cards });
const pass = { type: 'pass' as const };

test('ordre des cartes : le 3 est la plus faible, le 2 la plus forte', () => {
  assert.equal(presidentRank('3c'), 0);
  assert.equal(presidentRank('2s'), 12);
  assert.ok(presidentRank('2d') > presidentRank('Ah'));
  assert.ok(presidentRank('Ah') > presidentRank('Kh'));
  assert.ok(presidentRank('Td') > presidentRank('9d'));
  assert.deepEqual(presidentSort(['2c', '3d', 'Ah', 'Ts', '4c']), ['3d', '4c', 'Ts', 'Ah', '2c']);
});

test('le 3 de trèfle commence la première manche', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = presidentNewGame(names(4), seeded(seed));
    assert.ok(s.players[s.toAct].hand.includes('3c'));
    assert.equal(
      s.players.reduce((n, p) => n + p.hand.length, 0),
      52,
    );
    // The first play must include the 3 of clubs.
    for (const cards of presidentLegalPlays(s, s.toAct)) assert.ok(cards.includes('3c'));
    assert.ok(!presidentCanPass(s, s.toAct));
  }
  // Played alone or with other 3s.
  const s = make([['3c', '3d', '5h'], ['4c'], ['6c']], 0, { played: [] });
  assert.ok(presidentCanPlay(s, 0, ['3c']));
  assert.ok(presidentCanPlay(s, 0, ['3c', '3d']));
  assert.ok(!presidentCanPlay(s, 0, ['3d']));
  assert.ok(!presidentCanPlay(s, 0, ['5h']));
});

test('la distribution est aussi égale que possible', () => {
  for (const n of [3, 4, 5, 6, 7, 8]) {
    const sizes = presidentNewGame(names(n), seeded(n)).players.map((p) => p.hand.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    assert.equal(
      sizes.reduce((a, b) => a + b),
      52,
    );
  }
  assert.throws(() => presidentNewGame(names(2)));
  assert.throws(() => presidentNewGame(names(9)));
});

test('il faut jouer le même nombre de cartes', () => {
  const s = presidentApply(
    make([
      ['5c', '5d', '9h'],
      ['8c', '8d', '9c', 'Kd'],
      ['6c', 'Jh'],
    ]),
    0,
    play(['5c', '5d']),
  );
  assert.ok(!presidentCanPlay(s, 1, ['9c']));
  assert.ok(!presidentCanPlay(s, 1, ['8c', '8d', '9c']));
  assert.ok(presidentCanPlay(s, 1, ['8c', '8d']));
  assert.throws(() => presidentApply(s, 1, play(['Kd'])));
  // Mixed ranks are never a valid set.
  assert.ok(!presidentCanPlay(s, 1, ['8c', '9c']));
});

test('il faut une valeur strictement plus forte', () => {
  const s = presidentApply(
    make([
      ['8h', 'Kd'],
      ['8c', '9c', '7d'],
      ['6c', 'Jh'],
    ]),
    0,
    play(['8h']),
  );
  assert.ok(!presidentCanPlay(s, 1, ['8c']));
  assert.ok(!presidentCanPlay(s, 1, ['7d']));
  assert.ok(presidentCanPlay(s, 1, ['9c']));
  assert.deepEqual(presidentLegalPlays(s, 1), [['9c']]);
  // Not your turn: nothing is legal.
  assert.ok(!presidentCanPlay(s, 2, ['Jh']));
  assert.throws(() => presidentApply(s, 2, play(['Jh'])));
});

test('celui qui mène ne peut pas passer', () => {
  const s = make([['8h', 'Kd'], ['9c'], ['6c']]);
  assert.ok(!presidentCanPass(s, 0));
  assert.throws(() => presidentApply(s, 0, pass));
});

test('un 2 ferme le pli et son joueur rejoue', () => {
  let s = make([
    ['8h', '2d', '4c'],
    ['Ac', '9c'],
    ['6c', 'Kh'],
  ]);
  s = presidentApply(s, 0, play(['8h']));
  s = presidentApply(s, 1, play(['Ac']));
  s = presidentApply(s, 2, pass);
  s = presidentApply(s, 0, play(['2d']));
  assert.equal(s.trick.length, 0);
  assert.equal(s.toAct, 0);
  assert.equal(s.lastTrick?.winner, 0);
  assert.equal(s.players[2].passed, false);
});

test('le pli est gagné quand tous les autres passent', () => {
  let s = make([
    ['8h', '4c'],
    ['Ac', '9c'],
    ['6c', 'Kh'],
    ['5d', '7d'],
  ]);
  s = presidentApply(s, 0, play(['8h']));
  s = presidentApply(s, 1, play(['Ac']));
  s = presidentApply(s, 2, pass);
  assert.ok(s.players[2].passed);
  s = presidentApply(s, 3, pass);
  assert.equal(s.toAct, 0);
  s = presidentApply(s, 0, pass);
  assert.equal(s.trick.length, 0);
  assert.equal(s.toAct, 1);
  assert.equal(s.lastTrick?.winner, 1);
  assert.ok(s.players.every((p) => !p.passed));
});

test('on peut rejouer après avoir passé si le tour revient', () => {
  let s = make([
    ['5h', 'Qc', '4c'],
    ['7c', 'Ac'],
    ['6c', 'Kh'],
  ]);
  s = presidentApply(s, 0, play(['5h']));
  s = presidentApply(s, 1, pass);
  s = presidentApply(s, 2, play(['6c']));
  s = presidentApply(s, 0, play(['Qc']));
  // Player 1 passed earlier but may now play on the same trick.
  assert.equal(s.toAct, 1);
  assert.ok(presidentCanPlay(s, 1, ['Ac']));
  s = presidentApply(s, 1, play(['Ac']));
  assert.equal(s.trick.length, 4);
});

test('un joueur qui sort finit à la place suivante et passe la main', () => {
  // Player 0 goes out on the ace; once everyone passes, player 1 (next one still in) leads.
  let s = make([['Ac'], ['5c', '9c'], ['6c', 'Kh'], ['4d', '7d']]);
  s = presidentApply(s, 0, play(['Ac']));
  assert.deepEqual(s.finished, [0]);
  assert.equal(s.toAct, 1);
  s = presidentApply(s, 1, pass);
  s = presidentApply(s, 2, pass);
  assert.equal(s.trick.length, 1);
  s = presidentApply(s, 3, pass);
  assert.equal(s.trick.length, 0);
  assert.equal(s.toAct, 1);
  assert.equal(s.lastTrick?.winner, 0);

  // Going out on a 2: the next player still in leads at once.
  let t = make([['5c', '9c'], ['2c'], ['6c', 'Kh'], ['4d', '7d']], 1);
  t = presidentApply(t, 1, play(['2c']));
  assert.deepEqual(t.finished, [1]);
  assert.equal(t.trick.length, 0);
  assert.equal(t.toAct, 2);

  // Out after someone else beat him: the trick goes on without him.
  let u = make([['5c', '9c'], ['8c'], ['Jc', 'Kh'], ['4d', '7d']], 0);
  u = presidentApply(u, 0, play(['5c']));
  u = presidentApply(u, 1, play(['8c']));
  u = presidentApply(u, 2, play(['Jc']));
  u = presidentApply(u, 3, pass);
  u = presidentApply(u, 0, pass);
  // Player 1 has no cards: skipped; the trick goes back to player 2 who wins it.
  assert.equal(u.toAct, 2);
  assert.equal(u.lastTrick?.winner, 2);
});

test('la manche se termine quand un seul joueur a encore des cartes', () => {
  let s = make([['Ac'], ['5c', '9c'], ['2h']]);
  s = presidentApply(s, 0, play(['Ac']));
  s = presidentApply(s, 1, pass);
  s = presidentApply(s, 2, play(['2h']));
  assert.equal(s.phase, 'roundOver');
  assert.deepEqual(s.finished, [0, 2, 1]);
  assert.deepEqual(s.titles, ['president', 'trouduc', 'neutre']);
  assert.deepEqual(
    s.players.map((p) => p.score),
    [2, 0, 1],
  );
  assert.equal(s.toAct, -1);
});

test('titres pour 3, 4 et 8 joueurs', () => {
  assert.deepEqual(presidentTitles(3), ['president', 'neutre', 'trouduc']);
  assert.deepEqual(presidentTitles(4), ['president', 'vice-president', 'vice-trouduc', 'trouduc']);
  assert.deepEqual(presidentTitles(8), [
    'president',
    'vice-president',
    'neutre',
    'neutre',
    'neutre',
    'neutre',
    'vice-trouduc',
    'trouduc',
  ]);
});

test('points : Président 3 (2 sans vice), Vice 2, Neutre 1, les autres 0', () => {
  assert.equal(presidentPoints('president', 3), 2);
  assert.equal(presidentPoints('president', 4), 3);
  assert.equal(presidentPoints('vice-president', 5), 2);
  assert.equal(presidentPoints('neutre', 5), 1);
  assert.equal(presidentPoints('vice-trouduc', 5), 0);
  assert.equal(presidentPoints('trouduc', 5), 0);
  const s = {
    ...make([[], [], [], []]),
    players: make([[], [], [], []]).players.map((p, i) => ({ ...p, score: [3, 5, 5, 0][i] })),
  };
  assert.deepEqual(
    presidentStandings(s).map((e) => [e.index, e.place]),
    [
      [1, 1],
      [2, 1],
      [0, 3],
      [3, 4],
    ],
  );
});

test("l'échange : le Trouduc donne ses meilleures cartes au Président", () => {
  const ended = { ...make([[], [], [], []]), phase: 'roundOver' as const, round: 1 };
  const before: PresidentState = { ...ended, titles: ['neutre', 'trouduc', 'president', 'neutre'] };
  // Five players to get a vice pair too.
  const five: PresidentState = {
    ...presidentNewGame(names(5), seeded(3)),
    phase: 'roundOver',
    titles: ['trouduc', 'president', 'vice-trouduc', 'neutre', 'vice-president'],
  };
  const rng = seeded(42);
  const s = presidentNextRound(five, rng);
  assert.equal(s.phase, 'exchange');
  assert.equal(s.round, 2);
  // The automatic transfers.
  assert.equal(s.exchanges.length, 2);
  const [toPres, toVice] = s.exchanges;
  assert.equal(toPres.from, 0);
  assert.equal(toPres.to, 1);
  assert.equal(toPres.cards.length, 2);
  assert.equal(toVice.from, 2);
  assert.equal(toVice.to, 4);
  assert.equal(toVice.cards.length, 1);
  // They were the givers' best cards.
  for (const c of toPres.cards)
    for (const kept of s.players[0].hand) assert.ok(presidentRank(c) >= presidentRank(kept));
  for (const kept of s.players[2].hand) assert.ok(presidentRank(toVice.cards[0]) >= presidentRank(kept));
  assert.ok(toPres.cards.every((c) => s.players[1].hand.includes(c)));

  // The Président chooses 2 cards to give back, then the Vice-président 1.
  assert.equal(s.toAct, 1);
  assert.throws(() => presidentApply(s, 1, { type: 'give', cards: [s.players[1].hand[0]] }));
  assert.throws(() => presidentApply(s, 1, play([s.players[1].hand[0]])));
  const give = s.players[1].hand.slice(-2);
  let t = presidentApply(s, 1, { type: 'give', cards: give });
  assert.ok(give.every((c) => t.players[0].hand.includes(c)));
  assert.equal(t.toAct, 4);
  const back = presidentBotMove(t, 4);
  assert.deepEqual(back, { type: 'give', cards: [presidentSort(t.players[4].hand)[0]] });
  t = presidentApply(t, 4, back);
  // After the exchange, the Trouduc leads, with any card.
  assert.equal(t.phase, 'playing');
  assert.equal(t.toAct, 0);
  assert.equal(t.exchanges.length, 4);
  assert.equal(presidentLegalPlays(t, 0).length > 0, true);
  assert.equal(
    t.players.reduce((n, p) => n + p.hand.length, 0),
    52,
  );
  // Hand sizes are back to what was dealt.
  assert.deepEqual(
    t.players.map((p) => p.hand.length),
    presidentNextRound(five, seeded(42)).players.map(
      (p, i) => p.hand.length + (i === 1 ? -2 : i === 0 ? 2 : i === 4 ? -1 : i === 2 ? 1 : 0),
    ),
  );

  // Three players: no vice, only the Trouduc and the Président trade.
  const three = presidentNextRound(
    { ...before, players: before.players.slice(0, 3), titles: ['neutre', 'trouduc', 'president'] },
    rng,
  );
  assert.equal(three.exchanges.length, 1);
  assert.equal(three.pendingGives.length, 1);
  assert.throws(() => presidentNextRound(three, rng));
});

test('le robot joue des groupes entiers et garde ses 2', () => {
  // Leads its lowest group whole.
  let s = make([['4c', '4d', '9h', '2c', 'Kd'], ['5c'], ['6c']]);
  assert.deepEqual(presidentBotMove(s, 0), play(['4c', '4d']));
  // Follows with the cheapest rank without breaking a pair.
  s = presidentApply(
    make([['5c', 'Jh', 'Js', '8d', '9c', 'Td', 'Qd', 'Kd', '3s'], ['7h', '7d', 'Qh', '9d', '9s'], ['6c']]),
    0,
    play(['5c']),
  );
  assert.deepEqual(presidentBotMove(s, 1), play(['Qh']));
  // Does not spend a 2 early on a single.
  s = make(
    [
      ['5c', '4d', '8c', '9c'],
      ['2h', '3h', '3d', '3s', '4h', '4s', '5h', '6h', '6d'],
      ['6c', '7c', 'Tc'],
    ],
    1,
    {
      trick: [{ player: 0, cards: ['Kc'] }],
    },
  );
  assert.deepEqual(presidentBotMove(s, 1), pass);
  // With few cards left, uses the 2 to take the lead back.
  s = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, hand: ['4h', '6d', '2h'] } : p)) };
  assert.deepEqual(presidentBotMove(s, 1), play(['2h']));
  // Ends with 2s then the last group.
  s = make([['7c', '7d', '2s'], ['5c'], ['6c']]);
  assert.deepEqual(presidentBotMove(s, 0), play(['2s']));
});

test('fuzz : des parties entières entre robots, sans coup interdit', () => {
  const rng = seeded(2024);
  for (let game = 0; game < 120; game++) {
    const n = 3 + (game % 6);
    let s = presidentNewGame(names(n), rng);
    const rounds = 1 + (game % 4);
    let totalPoints = 0;
    for (let round = 1; round <= rounds; round++) {
      if (round > 1) s = presidentNextRound(s, rng);
      let moves = 0;
      while (s.phase !== 'roundOver') {
        const who = s.toAct;
        assert.ok(who >= 0 && who < n);
        if (s.phase === 'playing') {
          assert.ok(s.players[who].hand.length > 0, 'le joueur à qui c’est le tour a des cartes');
          assert.ok(presidentLegalPlays(s, who).length > 0 || presidentCanPass(s, who));
        }
        const move = presidentBotMove(s, who, rng);
        if (move.type === 'play') assert.ok(presidentCanPlay(s, who, move.cards));
        s = presidentApply(s, who, move);
        // The deck stays whole, with no card twice.
        const all = [...s.played, ...s.players.flatMap((p) => p.hand)];
        assert.equal(all.length, 52);
        assert.equal(new Set(all).size, 52);
        assert.ok(++moves < 2000, 'la manche se termine');
      }
      assert.equal(s.finished.length, n);
      assert.equal(new Set(s.finished).size, n);
      assert.deepEqual(
        s.finished.map((p) => s.titles[p]),
        presidentTitles(n),
      );
      totalPoints += presidentTitles(n).reduce((a, t) => a + presidentPoints(t, n), 0);
      assert.equal(
        s.players.reduce((a, p) => a + p.score, 0),
        totalPoints,
      );
    }
  }
});
