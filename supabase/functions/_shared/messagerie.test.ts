import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameError } from '../poker/logic.ts';
import {
  MESSAGE_BURST,
  MESSAGE_HOURLY,
  MESSAGE_MAX,
  MESSAGE_NOTIFY_GAP_MS,
  canSendMessage,
  cleanMessage,
  cleanUserId,
  shouldNotifyMessage,
} from './messagerie.ts';
import { chatUrl, messageNotice, noticePayload } from './notify.ts';

test('a message is trimmed, keeps its line breaks and loses control characters', () => {
  assert.equal(cleanMessage('  salut !  '), 'salut !');
  assert.equal(cleanMessage('a\r\nb'), 'a\nb');
  assert.equal(cleanMessage('a\n\n\n\n\nb'), 'a\n\nb');
  assert.equal(cleanMessage('a\u0000b\u0007c​d‮e'), 'abcde');
  assert.equal(cleanMessage('<b>gras</b> & co'), '<b>gras</b> & co', 'shown as text, never as markup');
});

test('an empty or odd message is refused', () => {
  assert.throws(() => cleanMessage(''), GameError);
  assert.throws(() => cleanMessage('   \n\t '), /Message vide/);
  assert.throws(() => cleanMessage(42), /Message vide/);
  assert.throws(() => cleanMessage(null), /Message vide/);
});

test('a long message is cut at the limit without breaking an emoji', () => {
  assert.equal(Array.from(cleanMessage('x'.repeat(900))).length, MESSAGE_MAX);
  const emojis = cleanMessage('🃏'.repeat(600));
  assert.equal(Array.from(emojis).length, MESSAGE_MAX);
  assert.ok(emojis.endsWith('🃏'));
  assert.equal(cleanMessage('é'.repeat(MESSAGE_MAX)), 'é'.repeat(MESSAGE_MAX));
});

test('at most a few messages in a row, and a cap per hour', () => {
  const now = 10_000_000;
  assert.equal(canSendMessage([], now), true);
  const burst = Array.from({ length: MESSAGE_BURST }, (_, i) => now - i * 1000);
  assert.equal(canSendMessage(burst, now), false);
  assert.equal(canSendMessage(burst.slice(1), now), true);
  // Ten seconds later the burst no longer counts.
  assert.equal(canSendMessage(burst, now + 10_000), true);
  const hour = Array.from({ length: MESSAGE_HOURLY }, (_, i) => now - 60_000 - i * 20_000);
  assert.equal(canSendMessage(hour, now), false);
  assert.equal(canSendMessage(hour, now + 3_600_000), true);
  assert.equal(canSendMessage([new Date(now - 500).toISOString()], now), true);
});

test('one notification for a run of unread messages', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  assert.equal(shouldNotifyMessage(null, now), true);
  const recent = { created_at: new Date(now - 30_000).toISOString(), read_at: null };
  assert.equal(shouldNotifyMessage(recent, now), false);
  assert.equal(shouldNotifyMessage({ ...recent, read_at: new Date(now - 1000).toISOString() }, now), true);
  const old = { created_at: new Date(now - MESSAGE_NOTIFY_GAP_MS).toISOString(), read_at: null };
  assert.equal(shouldNotifyMessage(old, now), true);
});

test('only real player ids are accepted', () => {
  const id = '3F2504E0-4F89-11D3-9A0C-0305E82C3301';
  assert.equal(cleanUserId(id), id.toLowerCase());
  assert.throws(() => cleanUserId('abc'), /Joueur inconnu/);
  assert.throws(() => cleanUserId(`${id}),or(x.eq.1`), /Joueur inconnu/);
  assert.throws(() => cleanUserId(undefined), GameError);
});

test('the notification of a message names the friend and opens the conversation', () => {
  const id = '00000000-0000-0000-0000-0000000000bb';
  const fr = messageNotice('fr', 'Léa', '  On se fait\nune belote ?  ', id);
  assert.deepEqual(fr, {
    kind: 'message',
    title: '💬 Léa',
    body: 'On se fait une belote ?',
    tag: `message-${id}`,
    url: chatUrl(id),
  });
  assert.equal(chatUrl(id), `./?ami=${id}`);
  const long = messageNotice('en', 'Tom', '😀'.repeat(300), id);
  assert.equal(Array.from(long.body).length, 120);
  assert.ok(long.body.endsWith('…'));
  assert.ok(noticePayload(long).length < 1000);
  assert.equal(messageNotice('en', 'Tom', '', id).body, 'New message');
});
