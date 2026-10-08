import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { GameError } from '../poker/logic.ts';
import {
  canInviteAgain,
  cleanSubscription,
  gameName,
  inviteNotice,
  newTurns,
  noticePayload,
  pokerToAct,
  subscriptionGone,
  tableUrl,
  turnNotice,
} from './notify.ts';
import { toBase64Url } from './webpush.ts';
import { humanActors, playGameMove, playGameTimeout, startGame } from '../jeux/logic.ts';

function browserKeys() {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  return { p256dh: toBase64Url(ua.getPublicKey()), auth: toBase64Url(randomBytes(16)) };
}

test('subscriptions from the real push services are kept, in the chosen language', () => {
  const keys = browserKeys();
  for (const endpoint of [
    'https://fcm.googleapis.com/fcm/send/dE7x:APA91b',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMx',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB',
  ]) {
    const sub = cleanSubscription({ endpoint, keys }, 'en');
    assert.deepEqual(sub, { endpoint, p256dh: keys.p256dh, auth: keys.auth, lang: 'en' });
  }
  assert.equal(cleanSubscription({ endpoint: 'https://web.push.apple.com/x', keys }, 'de').lang, 'fr');
  // Padding some browsers add is dropped.
  const padded = cleanSubscription(
    { endpoint: 'https://web.push.apple.com/x', keys: { ...keys, auth: `${keys.auth}==` } },
    'fr',
  );
  assert.equal(padded.auth, keys.auth);
});

test('any other address is refused, so the server cannot be made to call it', () => {
  const keys = browserKeys();
  for (const endpoint of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://evil.example/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.example/x',
    'https://notfcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://user@fcm.googleapis.com/x',
    'https://127.0.0.1/x',
    'not a url',
    `https://fcm.googleapis.com/${'a'.repeat(1100)}`,
  ]) {
    assert.throws(() => cleanSubscription({ endpoint, keys }, 'fr'), GameError, endpoint);
  }
  assert.throws(() => cleanSubscription(null, 'fr'), GameError);
});

test('subscriptions with broken keys are refused', () => {
  const keys = browserKeys();
  const endpoint = 'https://fcm.googleapis.com/fcm/send/x';
  assert.throws(() => cleanSubscription({ endpoint, keys: { ...keys, p256dh: 'abc' } }, 'fr'), GameError);
  assert.throws(() => cleanSubscription({ endpoint, keys: { ...keys, auth: 'a+b/' } }, 'fr'), GameError);
  assert.throws(
    () => cleanSubscription({ endpoint, keys: { ...keys, auth: toBase64Url(randomBytes(12)) } }, 'fr'),
    GameError,
  );
  assert.throws(() => cleanSubscription({ endpoint, keys: { p256dh: keys.p256dh } }, 'fr'), GameError);
});

test('a push service saying gone means the subscription is forgotten', () => {
  assert.equal(subscriptionGone(410), true);
  assert.equal(subscriptionGone(404), true);
  assert.equal(subscriptionGone(429), false);
  assert.equal(subscriptionGone(201), false);
});

test('an invitation names the friend, the game and the code, in each language', () => {
  assert.deepEqual(inviteNotice('fr', 'Léa', 'belote', 'ABC123'), {
    kind: 'invite',
    title: 'Léa t’invite à jouer',
    body: 'Rejoins sa table de Belote (code ABC123).',
    tag: 'invite-ABC123',
    url: './?jeu=belote&table=ABC123',
  });
  const en = inviteNotice('en', 'Léa', 'yams', 'XYZ789');
  assert.equal(en.title, 'Léa invites you to play');
  assert.equal(en.body, 'Join their Yahtzee table (code XYZ789).');
});

test('a turn notice replaces the previous one of the same table', () => {
  const a = turnNotice('fr', 'poker', 'ABC123');
  const b = turnNotice('fr', 'poker', 'ABC123');
  assert.equal(a.title, 'À toi de jouer !');
  assert.equal(a.body, 'Tes amis t’attendent à la table de Poker.');
  assert.equal(a.tag, b.tag);
  assert.notEqual(a.tag, turnNotice('fr', 'poker', 'OTHER1').tag);
  assert.equal(
    turnNotice('en', 'puissance4', 'ABC123').body,
    'Your friends are waiting for you at the Connect 4 table.',
  );
});

test('the payload is small JSON the service worker can read', () => {
  const payload = noticePayload(inviteNotice('fr', 'Un prénom très long', 'tarot', 'ABC123'));
  const parsed = JSON.parse(payload);
  assert.deepEqual(Object.keys(parsed).sort(), ['body', 'kind', 'tag', 'title', 'url']);
  assert.ok(new TextEncoder().encode(payload).length < 1000);
  const long = noticePayload({
    kind: 'turn',
    title: 'x'.repeat(500),
    body: 'y'.repeat(500),
    tag: 't',
    url: './',
  });
  assert.equal(JSON.parse(long).title.length, 80);
  assert.equal(JSON.parse(long).body.length, 200);
});

test('unknown games keep a readable name and the link is escaped', () => {
  assert.equal(gameName('morpion', 'fr'), 'Morpion');
  assert.equal(gameName('huit', 'en'), 'Crazy Eights');
  assert.equal(tableUrl('a&b', 'C D'), './?jeu=a%26b&table=C%20D');
});

test('only people whose turn just started are told, never robots', () => {
  assert.deepEqual(newTurns([], ['a']), ['a']);
  assert.deepEqual(newTurns(['a'], ['a']), []);
  assert.deepEqual(newTurns(['a'], ['b']), ['b']);
  assert.deepEqual(newTurns(['a'], ['a', 'b', 'c']), ['b', 'c']);
  assert.deepEqual(newTurns([], ['bot', 'b', 'b'], ['bot']), ['b']);
});

test('who acts in a poker hand', () => {
  const players = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(pokerToAct({ street: 'flop', toAct: 1, players }), ['b']);
  assert.deepEqual(pokerToAct({ street: 'finished', toAct: 1, players }), []);
  assert.deepEqual(pokerToAct({ street: 'river', toAct: -1, players }), []);
  assert.deepEqual(pokerToAct(null), []);
});

test('the same friend is invited to the same table at most once a minute', () => {
  const now = Date.UTC(2026, 9, 8, 12);
  assert.equal(canInviteAgain(null, now), true);
  assert.equal(canInviteAgain(new Date(now - 30_000).toISOString(), now), false);
  assert.equal(canInviteAgain(new Date(now - 60_000).toISOString(), now), true);
});

test('at an online table, a turn notice goes to the next person once the previous one is done', () => {
  const room = {
    id: 'room',
    code: 'ABCDEF',
    game: 'yams' as const,
    host_id: 'a',
    options: {},
    status: 'lobby' as const,
    version: 0,
  };
  const seat = (user_id: string, s: number, is_bot = false) => ({
    user_id,
    name: user_id.toUpperCase(),
    seat: s,
    is_bot,
  });
  const rng = (n: number) => 0 % n;
  const { snapshot } = startGame(room, [seat('a', 0), seat('b', 1)], 'a', () => 'x', rng, 1000);
  assert.deepEqual(humanActors(snapshot.secret), ['a']);
  // Rolling again keeps the turn: no new notice.
  const rolled = playGameMove(snapshot.secret, 'a', { type: 'roll' }, rng, 1000);
  assert.deepEqual(newTurns(humanActors(snapshot.secret), humanActors(rolled.secret)), []);
  let s = rolled;
  while (s.public.actors[0] === 'a') s = playGameTimeout(s.secret, rng, s.secret.deadline!);
  assert.deepEqual(newTurns(humanActors(rolled.secret), humanActors(s.secret)), ['b']);

  // A robot's turn tells nobody.
  let t = startGame(room, [seat('a', 0), seat('r', 1, true)], 'a', () => 'x', rng, 1000).snapshot;
  while (t.public.actors[0] === 'a') t = playGameTimeout(t.secret, rng, t.secret.deadline!);
  assert.deepEqual(t.public.actors, ['r']);
  assert.deepEqual(humanActors(t.secret), []);
});
