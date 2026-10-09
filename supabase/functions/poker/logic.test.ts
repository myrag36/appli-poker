import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../_shared/engine/index.ts';
import {
  type RoomRow,
  BOT_MS,
  TURN_MS,
  dealNextHand,
  checkRemoval,
  firstFreeSeat,
  handRecords,
  makeRoomCode,
  newBot,
  parseAction,
  playAction,
  pausedState,
  playTimeout,
  pokerRematch,
  pokerRematchJoin,
  pokerResults,
  rematchSeat,
} from './logic.ts';

const NOW = 1_000_000;

const room = (over: Partial<RoomRow> = {}): RoomRow => ({
  id: 'room',
  host_id: 'a',
  big_blind: 20,
  starting_stack: 1000,
  dealer: 0,
  hand_number: 0,
  version: 3,
  ...over,
});
const players = [
  { user_id: 'a', name: 'Simon', seat: 0, stack: 1000 },
  { user_id: 'b', name: 'Léa', seat: 2, stack: 1000 },
  { user_id: 'c', name: 'Hugo', seat: 5, stack: 0 },
];

test('code de table : 6 caractères sans lettres ambiguës', () => {
  for (let i = 0; i < 200; i++) assert.match(makeRoomCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});

test('première place libre', () => {
  assert.equal(firstFreeSeat(players), 1);
});

test('la vue publique ne contient ni le paquet ni les cartes', () => {
  const save = dealNextHand(room(), players, null, NOW);
  assert.equal('deck' in save.p_public, false);
  assert.ok(save.p_public.players.every((p) => p.hole.length === 0));
  assert.deepEqual(Object.keys(save.p_hands!).sort(), ['a', 'b']); // Hugo n'a plus de jetons
  assert.equal(save.p_hands!.a.length, 2);
  assert.equal(save.p_version, 3);
  assert.equal(save.p_hand_number, 1);
});

test('le bouton avance à la place suivante qui a des jetons', () => {
  assert.equal(dealNextHand(room(), players, null, NOW).p_dealer, 0);
  const first = dealNextHand(room(), players, null, NOW).p_secret;
  const finished = applyAction(first, first.players[first.toAct].id, { type: 'fold' });
  assert.equal(dealNextHand(room({ hand_number: 1, dealer: 0 }), players, finished, NOW).p_dealer, 2);
  assert.equal(dealNextHand(room({ hand_number: 2, dealer: 2 }), players, finished, NOW).p_dealer, 0);
});

test('impossible de redistribuer pendant une main', () => {
  const hand = dealNextHand(room(), players, null, NOW).p_secret;
  assert.throws(() => dealNextHand(room({ hand_number: 1 }), players, hand, NOW), /pas finie/);
});

test('une action met à jour les tapis et garde les cartes secrètes', () => {
  const hand = dealNextHand(room(), players, null, NOW).p_secret;
  const actor = hand.players[hand.toAct].id;
  const other = actor === 'a' ? 'b' : 'a';
  assert.throws(() => playAction(room(), hand, other, { type: 'call' }, NOW), /pas ton tour/);
  const save = playAction(room(), hand, actor, { type: 'raise', to: 60 }, NOW);
  assert.equal(save.p_stacks![actor], 940);
  assert.ok(save.p_public.players.every((p) => p.hole.length === 0));
});

test('les actions venant du téléphone sont vérifiées', () => {
  assert.deepEqual(parseAction({ type: 'raise', to: 40 }), { type: 'raise', to: 40 });
  assert.throws(() => parseAction({ type: 'raise', to: '40' }));
  assert.throws(() => parseAction({ type: 'tricher' }));
  assert.throws(() => parseAction(null));
});

test('chaque tour a une heure limite, sauf en fin de main', () => {
  const save = dealNextHand(room(), players, null, NOW);
  assert.equal(save.p_public.deadline, NOW + TURN_MS);
  const actor = save.p_secret.players[save.p_secret.toAct].id;
  const folded = playAction(room(), save.p_secret, actor, { type: 'fold' }, NOW + 5);
  assert.equal(folded.p_public.street, 'finished');
  assert.equal(folded.p_public.deadline, null);
});

test('temps écoulé : le joueur se couche, ou checke quand il peut', () => {
  const deal = dealNextHand(room(), players, null, NOW);
  const r = room({ public_state: deal.p_public });
  assert.throws(() => playTimeout(r, deal.p_secret, NOW + TURN_MS - 1), /pas encore/);

  // Avant le flop, le premier à parler doit payer la grosse blinde : il se couche.
  const late = playTimeout(r, deal.p_secret, NOW + TURN_MS);
  assert.equal(late.p_public.street, 'finished');
  assert.ok(late.p_secret.players.some((p) => p.folded));

  // La grosse blinde peut checker quand tout le monde a suivi : elle checke.
  const called = playAction(
    r,
    deal.p_secret,
    deal.p_secret.players[deal.p_secret.toAct].id,
    { type: 'call' },
    NOW,
  );
  const r2 = room({ public_state: called.p_public });
  const checked = playTimeout(r2, called.p_secret, NOW + 2 * TURN_MS);
  assert.equal(checked.p_public.street, 'flop');
  assert.ok(checked.p_secret.players.every((p) => !p.folded));
});

test('en tournoi, les blindes montent avec le temps et les actions gardent le niveau', () => {
  const t = room({ level_minutes: 10, started_at: new Date(NOW).toISOString() });
  const first = dealNextHand(t, players, null, NOW + 60_000);
  assert.equal(first.p_secret.bigBlind, 20);
  assert.deepEqual(first.p_public.tournament, { level: 0, nextLevelAt: NOW + 600_000 });

  const finished = applyAction(first.p_secret, first.p_secret.players[first.p_secret.toAct].id, {
    type: 'fold',
  });
  const later = dealNextHand({ ...t, hand_number: 1 }, players, finished, NOW + 25 * 60_000);
  assert.equal(later.p_secret.bigBlind, 40);
  assert.equal(later.p_secret.smallBlind, 20);
  assert.equal(later.p_public.tournament?.level, 2);

  const acted = playAction(
    { ...t, public_state: later.p_public },
    later.p_secret,
    later.p_secret.players[later.p_secret.toAct].id,
    { type: 'fold' },
    NOW + 26 * 60_000,
  );
  assert.deepEqual(acted.p_public.tournament, later.p_public.tournament);
});

test('sans tournoi, les blindes ne changent jamais', () => {
  const p = dealNextHand(room({ started_at: new Date(NOW).toISOString() }), players, null, NOW + 3_600_000);
  assert.equal(p.p_secret.bigBlind, 20);
  assert.equal(p.p_public.tournament, null);
});

test('rien à enregistrer tant que la main continue', () => {
  const dealt = dealNextHand(room(), players, null, NOW);
  assert.equal(handRecords(room(), players, dealt), null);
});

test('main finie : historique, résultats, et fin de partie quand un seul joueur a des jetons', () => {
  const dealt = dealNextHand(room({ hand_number: 4 }), players, null, NOW);
  const r = room({ hand_number: 5 });
  // Everyone goes all-in until the hand is over.
  let saved = dealt;
  while (saved.p_secret.street !== 'finished') {
    const hand = saved.p_secret;
    saved = playAction(r, hand, hand.players[hand.toAct].id, { type: 'allin' }, NOW);
  }
  const records = handRecords(r, players, saved)!;
  assert.equal(records.history.hand_number, 5);
  assert.equal(records.history.summary.street, 'finished');
  assert.deepEqual(records.results.map((x) => x.user_id).sort(), ['a', 'b']);
  assert.equal(
    records.results.reduce((s, x) => s + x.net, 0),
    0,
  );
  // Equal stacks all-in: a split pot leaves both in the game, otherwise the winner takes it.
  const winners = records.results.filter((x) => x.won);
  if (winners.length === 2) assert.equal(records.game, null);
  else
    assert.deepEqual(records.game, {
      room_id: 'room',
      winner_id: winners[0].user_id,
      players: 3,
      tournament: false,
    });
});

test('classement de la semaine : le gagnant premier, les autres deuxièmes, sans les robots', () => {
  const seated = [
    { user_id: 'a', name: 'Simon', seat: 0, stack: 0 },
    { user_id: 'b', name: 'Léa', seat: 1, stack: 2000 },
    { user_id: 'r', name: 'Robby', seat: 2, stack: 0, is_bot: true },
  ];
  assert.deepEqual(pokerResults('room', seated, 'b'), [
    { room_id: 'room', user_id: 'a', game: 'poker', placement: 2, won: false, players: 3 },
    { room_id: 'room', user_id: 'b', game: 'poker', placement: 1, won: true, players: 3 },
  ]);
});

test('le numéro de la main distribuée est celui enregistré', () => {
  const twoAllIn = [
    { user_id: 'a', name: 'Simon', seat: 0, stack: 10 },
    { user_id: 'b', name: 'Léa', seat: 1, stack: 10 },
  ];
  // Blinds bigger than both stacks: the hand is over as soon as it is dealt.
  const r = room({ big_blind: 20, hand_number: 7 });
  const dealt = dealNextHand(r, twoAllIn, null, NOW);
  assert.equal(dealt.p_secret.street, 'finished');
  assert.equal(handRecords(r, twoAllIn, dealt)!.history.hand_number, 8);
});

test('en pause, personne ne peut jouer, distribuer ou faire passer le temps', () => {
  const r = room();
  const dealt = dealNextHand(r, players, null, NOW);
  const paused = room({ paused: true, hand_number: 1, public_state: dealt.p_public });
  const actor = dealt.p_secret.players[dealt.p_secret.toAct].id;
  assert.throws(() => playAction(paused, dealt.p_secret, actor, { type: 'call' }, NOW), /pause/);
  assert.throws(() => playTimeout(paused, dealt.p_secret, NOW + TURN_MS + 1), /pause/);
  assert.throws(() => dealNextHand(room({ paused: true }), players, null, NOW), /pause/);
});

test('la pause arrête le chrono, la reprise redonne un tour complet', () => {
  const dealt = dealNextHand(room(), players, null, NOW);
  const r = room({ hand_number: 1, public_state: dealt.p_public });
  assert.equal(pausedState(r, true, NOW + 5000)!.deadline, null);
  assert.equal(
    pausedState({ ...r, public_state: pausedState(r, true, NOW) }, false, NOW + 60_000)!.deadline,
    NOW + 60_000 + TURN_MS,
  );
  assert.equal(pausedState(room(), true, NOW), null);
});

test('retirer un joueur : réservé au créateur, et pas pendant sa main', () => {
  const dealt = dealNextHand(room(), players, null, NOW);
  const playing = room({ hand_number: 1, public_state: dealt.p_public });
  assert.throws(() => checkRemoval(room(), players, 'b', 'a'), /créateur/);
  assert.throws(() => checkRemoval(room(), players, 'a', 'a'), /toi-même/);
  assert.throws(() => checkRemoval(room(), players, 'a', 'z'), /plus à la table/);
  assert.throws(() => checkRemoval(playing, players, 'a', 'b'), /fin de la main/);
  // Hugo has no chips, so he is not in the hand and can go at any time.
  checkRemoval(playing, players, 'a', 'c');
  checkRemoval(room(), players, 'a', 'b');
});

test('robots : pas de cartes privées, un chrono court, et ils jouent quand leur temps est écoulé', () => {
  const withBot = [
    { user_id: 'a', name: 'Simon', seat: 0, stack: 1000 },
    { user_id: 'r', name: 'Robby', seat: 1, stack: 1000, is_bot: true },
  ];
  const r = room();
  const dealt = dealNextHand(r, withBot, null, NOW);
  assert.deepEqual(Object.keys(dealt.p_hands!), ['a']);
  assert.deepEqual(dealt.p_public.bots, ['r']);
  const actorId = dealt.p_secret.players[dealt.p_secret.toAct].id;
  assert.equal(dealt.p_public.deadline, NOW + (actorId === 'r' ? BOT_MS : TURN_MS));

  // Play the hand out: people call or check, robots play when asked after their deadline.
  let state = { room: room({ hand_number: 1, public_state: dealt.p_public }), hand: dealt.p_secret };
  let moves = 0;
  while (state.hand.street !== 'finished') {
    const id = state.hand.players[state.hand.toAct].id;
    const t = state.room.public_state!.deadline!;
    const saved =
      id === 'r'
        ? playTimeout(state.room, state.hand, t)
        : playAction(state.room, state.hand, id, legalActionsFor(state.hand, id), t - 1000);
    state = { room: { ...state.room, public_state: saved.p_public }, hand: saved.p_secret };
    assert.ok(++moves < 50);
  }
  const records = handRecords(state.room, withBot, {
    p_room: 'room',
    p_version: 1,
    p_public: state.room.public_state!,
    p_secret: state.hand,
    p_stacks: Object.fromEntries(state.hand.players.map((p) => [p.id, p.stack])),
  })!;
  // Statistics only for the person.
  assert.deepEqual(
    records.results.map((x) => x.user_id),
    ['a'],
  );
  if (records.game) assert.equal(records.game.winner_id, 'a');
});

function legalActionsFor(hand: Parameters<typeof applyAction>[0], id: string) {
  const call = hand.currentBet - hand.players.find((p) => p.id === id)!.bet;
  return call > 0 ? ({ type: 'call' } as const) : ({ type: 'check' } as const);
}

test('ajouter un robot : réservé au créateur, nom et place libres', () => {
  const bot = newBot(room(), players, 'a', 'id-1');
  assert.equal(bot.seat, 1);
  assert.equal(bot.name, 'Robby');
  assert.equal(bot.is_bot, true);
  assert.equal(bot.stack, 1000);
  assert.throws(() => newBot(room(), players, 'b', 'id-2'), /créateur/);
  const full = Array.from({ length: 8 }, (_, i) => ({ user_id: `u${i}`, name: `J${i}`, seat: i, stack: 10 }));
  assert.throws(() => newBot(room(), full, 'a', 'id-3'), /pleine/);
});

test('table Omaha : quatre cartes privées, mise limitée au pot', () => {
  const dealt = dealNextHand(room({ variant: 'omaha' }), players, null, NOW);
  assert.equal(dealt.p_secret.variant, 'omaha');
  for (const cards of Object.values(dealt.p_hands!)) assert.equal(cards.length, 4);
  // Heads-up: the dealer has 10 to call into a pot of 30, so the pot raise goes to 20 + 30 + 10 = 60.
  const actor = dealt.p_secret.players[dealt.p_secret.toAct].id;
  assert.throws(() =>
    playAction(room({ hand_number: 1 }), dealt.p_secret, actor, { type: 'raise', to: 61 }, NOW),
  );
  playAction(room({ hand_number: 1 }), dealt.p_secret, actor, { type: 'raise', to: 60 }, NOW);
});

test('revanche : seulement une fois la partie finie, mêmes réglages, places d’avant', () => {
  const seated = [
    { user_id: 'a', name: 'Simon', seat: 0, stack: 2000, avatar: '🦊', avatar_color: '#f00' },
    { user_id: 'r', name: 'Robby', seat: 3, stack: 0, is_bot: true, avatar: '🤖', avatar_color: '#0f0' },
    { user_id: 'b', name: 'Léa', seat: 5, stack: 0, avatar: null, avatar_color: null },
  ];
  const finished = room({
    level_minutes: 10,
    variant: 'omaha',
    public_state: { street: 'finished' } as RoomRow['public_state'],
  });
  // A hand still being played, or two players with chips left: not over.
  assert.throws(
    () => pokerRematch(room({ public_state: { street: 'flop' } as never }), seated, 'b'),
    /pas finie/,
  );
  assert.throws(
    () =>
      pokerRematch(
        finished,
        seated.map((p) => ({ ...p, stack: 1000 })),
        'b',
      ),
    /pas finie/,
  );
  assert.throws(() => pokerRematch(finished, seated, 'z'), /pas à cette table/);
  assert.throws(() => pokerRematch(finished, seated, 'r'), /pas à cette table/);

  const plan = pokerRematch(finished, seated, 'b');
  assert.deepEqual(plan.room, {
    host_id: 'b',
    big_blind: 20,
    starting_stack: 1000,
    level_minutes: 10,
    variant: 'omaha',
  });
  // The asker and the robots, with fresh chips.
  assert.deepEqual(
    plan.players.map((p) => [p.user_id, p.seat, p.stack, p.is_bot]),
    [
      ['r', 3, 1000, true],
      ['b', 5, 1000, false],
    ],
  );

  const next = { id: 'next', starting_stack: 1000 };
  const row = pokerRematchJoin(next, plan.players, seated, 'a')!;
  assert.deepEqual(
    [row.room_id, row.user_id, row.name, row.seat, row.stack, row.avatar],
    ['next', 'a', 'Simon', 0, 1000, '🦊'],
  );
  assert.equal(pokerRematchJoin(next, [...plan.players, { ...row }], seated, 'a'), null);
  // My old seat was taken by someone else: the first free one.
  const other = { user_id: 'x', name: 'Max', seat: 0, stack: 1000 };
  assert.equal(pokerRematchJoin(next, [...plan.players, other], seated, 'a')!.seat, 1);
  assert.throws(() => pokerRematchJoin(next, plan.players, seated, 'z'), /pas à cette table/);
});

test('place à la revanche : l’ancienne si libre, sinon la première libre', () => {
  assert.equal(rematchSeat(2, [{ seat: 0 }]), 2);
  assert.equal(rematchSeat(0, [{ seat: 0 }, { seat: 1 }]), 2);
  assert.throws(
    () =>
      rematchSeat(
        0,
        [0, 1, 2].map((seat) => ({ seat })),
        3,
      ),
    /pleine/,
  );
});
