import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../_shared/engine/index.ts';
import { type RoomRow, dealNextHand, firstFreeSeat, makeRoomCode, parseAction, playAction } from './logic.ts';

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
  const save = dealNextHand(room(), players, null);
  assert.equal('deck' in save.p_public, false);
  assert.ok(save.p_public.players.every((p) => p.hole.length === 0));
  assert.deepEqual(Object.keys(save.p_hands!).sort(), ['a', 'b']); // Hugo n'a plus de jetons
  assert.equal(save.p_hands!.a.length, 2);
  assert.equal(save.p_version, 3);
  assert.equal(save.p_hand_number, 1);
});

test('le bouton avance à la place suivante qui a des jetons', () => {
  assert.equal(dealNextHand(room(), players, null).p_dealer, 0);
  const first = dealNextHand(room(), players, null).p_secret;
  const finished = applyAction(first, first.players[first.toAct].id, { type: 'fold' });
  assert.equal(dealNextHand(room({ hand_number: 1, dealer: 0 }), players, finished).p_dealer, 2);
  assert.equal(dealNextHand(room({ hand_number: 2, dealer: 2 }), players, finished).p_dealer, 0);
});

test('impossible de redistribuer pendant une main', () => {
  const hand = dealNextHand(room(), players, null).p_secret;
  assert.throws(() => dealNextHand(room({ hand_number: 1 }), players, hand), /pas finie/);
});

test('une action met à jour les tapis et garde les cartes secrètes', () => {
  const hand = dealNextHand(room(), players, null).p_secret;
  const actor = hand.players[hand.toAct].id;
  const other = actor === 'a' ? 'b' : 'a';
  assert.throws(() => playAction(room(), hand, other, { type: 'call' }), /pas ton tour/);
  const save = playAction(room(), hand, actor, { type: 'raise', to: 60 });
  assert.equal(save.p_stacks![actor], 940);
  assert.ok(save.p_public.players.every((p) => p.hole.length === 0));
});

test('les actions venant du téléphone sont vérifiées', () => {
  assert.deepEqual(parseAction({ type: 'raise', to: 40 }), { type: 'raise', to: 40 });
  assert.throws(() => parseAction({ type: 'raise', to: '40' }));
  assert.throws(() => parseAction({ type: 'tricher' }));
  assert.throws(() => parseAction(null));
});
