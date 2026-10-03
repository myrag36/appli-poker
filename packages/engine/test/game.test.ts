import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type HandState, applyAction, legalActions, startHand, viewFor } from '../src/game.ts';
import { newDeck } from '../src/cards.ts';

/** RNG that leaves the deck unshuffled, so cards come off the end in a known order. */
const fixed = () => (i: number) => i - 1;
const total = (s: HandState) => s.players.reduce((a, p) => a + p.stack + 0, 0);

function seats(...stacks: number[]) {
  return stacks.map((stack, i) => ({ id: `p${i}`, name: `Joueur ${i}`, stack }));
}

function act(s: HandState, ...actions: Parameters<typeof applyAction>[2][]) {
  for (const a of actions) s = applyAction(s, s.players[s.toAct].id, a);
  return s;
}

test('blindes et premier à parler à 3 joueurs', () => {
  const s = startHand({ seats: seats(100, 100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  assert.deepEqual(s.players.map((p) => p.bet), [0, 1, 2]);
  assert.equal(s.toAct, 0);
  assert.equal(s.players.every((p) => p.hole.length === 2), true);
});

test('en tête-à-tête le donneur poste la petite blinde et parle en premier', () => {
  const s = startHand({ seats: seats(100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  assert.deepEqual(s.players.map((p) => p.bet), [1, 2]);
  assert.equal(s.toAct, 0);
});

test('tout le monde se couche : la grosse blinde gagne', () => {
  let s = startHand({ seats: seats(100, 100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  s = act(s, { type: 'fold' }, { type: 'fold' });
  assert.equal(s.street, 'finished');
  assert.deepEqual(s.players.map((p) => p.stack), [100, 99, 101]);
});

test('la grosse blinde a une option quand tout le monde suit', () => {
  let s = startHand({ seats: seats(100, 100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  s = act(s, { type: 'call' }, { type: 'call' });
  assert.equal(s.street, 'preflop');
  assert.equal(s.players[s.toAct].id, 'p2');
  assert.equal(legalActions(s, 'p2')!.check, true);
  s = act(s, { type: 'check' });
  assert.equal(s.street, 'flop');
  assert.equal(s.board.length, 3);
  assert.equal(s.players[s.toAct].id, 'p1'); // après le flop, la petite blinde parle en premier
});

test('main jouée jusqu\'à l\'abattage, jetons conservés', () => {
  let s = startHand({ seats: seats(100, 100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  s = act(s, { type: 'raise', to: 6 }, { type: 'call' }, { type: 'call' });
  for (let street = 0; street < 3; street++) s = act(s, { type: 'check' }, { type: 'check' }, { type: 'check' });
  assert.equal(s.street, 'finished');
  assert.equal(s.board.length, 5);
  assert.equal(total(s), 300);
  assert.equal(s.pots.reduce((a, p) => a + p.amount, 0), 18);
});

test('relance minimale et relance trop petite refusée', () => {
  let s = startHand({ seats: seats(100, 100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  assert.deepEqual(legalActions(s, 'p0')!.raise, { min: 4, max: 100 });
  assert.throws(() => applyAction(s, 'p0', { type: 'raise', to: 3 }));
  s = act(s, { type: 'raise', to: 10 });
  assert.deepEqual(legalActions(s, 'p1')!.raise, { min: 18, max: 100 });
  assert.throws(() => applyAction(s, 'p2', { type: 'call' }), /pas ton tour/);
});

test('pots secondaires avec un tapis court', () => {
  // Sans mélange, les cartes partent de la fin du paquet : on choisit le paquet pour connaître les mains.
  let s = startHand({ seats: seats(20, 100, 100), dealer: 0, smallBlind: 1, bigBlind: 2, rng: fixed() });
  s = act(s, { type: 'allin' }, { type: 'call' }, { type: 'raise', to: 50 }, { type: 'call' });
  while (s.street !== 'finished') s = act(s, { type: 'check' });
  assert.equal(total(s), 220);
  assert.equal(s.pots.length, 2);
  assert.equal(s.pots[0].amount, 60);
  assert.equal(s.pots[1].amount, 60);
  assert.ok(!s.pots[1].winners.includes('p0'));
});

test('tous à tapis : le tableau est distribué automatiquement', () => {
  let s = startHand({ seats: seats(50, 50), dealer: 0, smallBlind: 1, bigBlind: 2 });
  s = act(s, { type: 'allin' }, { type: 'call' });
  assert.equal(s.street, 'finished');
  assert.equal(s.board.length, 5);
  assert.equal(total(s), 100);
});

test('une relance à tapis trop courte ne rouvre pas les relances', () => {
  let s = startHand({ seats: seats(100, 100, 13), dealer: 0, smallBlind: 1, bigBlind: 2 });
  s = act(s, { type: 'raise', to: 10 }, { type: 'call' }); // p0 relance, p1 suit
  s = act(s, { type: 'allin' }); // p2 relance à 13 : relance incomplète
  assert.equal(s.players[s.toAct].id, 'p0');
  assert.equal(legalActions(s, 'p0')!.raise, null);
  assert.equal(legalActions(s, 'p0')!.call, 3);
});

test('les cartes des autres restent cachées', () => {
  const s = startHand({ seats: seats(100, 100), dealer: 0, smallBlind: 1, bigBlind: 2 });
  const v = viewFor(s, 'p0');
  assert.equal(v.players[0].hole.length, 2);
  assert.equal(v.players[1].hole.length, 0);
  assert.equal('deck' in v, false);
});

test('le paquet contient 52 cartes distinctes', () => {
  assert.equal(new Set(newDeck()).size, 52);
});
