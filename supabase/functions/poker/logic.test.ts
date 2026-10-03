import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../_shared/engine/index.ts';
import {
  type RoomRow,
  TURN_MS,
  dealNextHand,
  firstFreeSeat,
  handRecords,
  makeRoomCode,
  parseAction,
  playAction,
  playTimeout,
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
  const called = playAction(r, deal.p_secret, deal.p_secret.players[deal.p_secret.toAct].id, { type: 'call' }, NOW);
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

  const finished = applyAction(first.p_secret, first.p_secret.players[first.p_secret.toAct].id, { type: 'fold' });
  const later = dealNextHand({ ...t, hand_number: 1 }, players, finished, NOW + 25 * 60_000);
  assert.equal(later.p_secret.bigBlind, 40);
  assert.equal(later.p_secret.smallBlind, 20);
  assert.equal(later.p_public.tournament?.level, 2);

  const acted = playAction({ ...t, public_state: later.p_public }, later.p_secret, later.p_secret.players[later.p_secret.toAct].id, { type: 'fold' }, NOW + 26 * 60_000);
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
