import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto';
import {
  buildPushRequest,
  encryptPayload,
  fromBase64Url,
  generateVapidKeys,
  toBase64Url,
  vapidAuthorization,
} from './webpush.ts';

/** A P-256 private key given as raw `d` plus its public point, for Web Crypto. */
async function importPair(d: string, pub: string): Promise<CryptoKeyPair> {
  const raw = fromBase64Url(pub);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(raw.slice(1, 33)),
    y: toBase64Url(raw.slice(33, 65)),
  };
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { ...jwk, d },
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
  return { privateKey, publicKey };
}

test('base64url goes both ways without padding', () => {
  const bytes = new Uint8Array([0, 255, 62, 63, 250, 1]);
  assert.equal(toBase64Url(bytes), 'AP8-P_oB');
  assert.deepEqual(fromBase64Url('AP8-P_oB'), bytes);
  assert.deepEqual(fromBase64Url(toBase64Url(new Uint8Array([7]))), new Uint8Array([7]));
});

test('encryption matches the example of RFC 8291 (appendix A)', async () => {
  const body = await encryptPayload(
    new TextEncoder().encode('When I grow up, I want to be a watermelon'),
    {
      p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    },
    {
      salt: fromBase64Url('DGv6ra1nlYgDCS1FRnbzlw'),
      serverKeys: await importPair(
        'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
        'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      ),
    },
  );
  assert.equal(
    toBase64Url(body),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  );
});

/** Decrypts like a browser would, with Node's own crypto. */
function browserDecrypt(body: Uint8Array, uaPrivate: ReturnType<typeof createECDH>, auth: Buffer): string {
  const buf = Buffer.from(body);
  const salt = buf.subarray(0, 16);
  const rs = buf.readUInt32BE(16);
  const idlen = buf[20];
  const asPublic = buf.subarray(21, 21 + idlen);
  const cipher = buf.subarray(21 + idlen);
  assert.equal(rs, 4096);
  assert.equal(idlen, 65);
  const shared = uaPrivate.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), uaPrivate.getPublicKey(), asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, info, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, 'last record delimiter');
  return plain.subarray(0, plain.length - 1).toString('utf8');
}

test('a browser can read the message, and each message uses a new key and salt', async () => {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  const keys = { p256dh: toBase64Url(ua.getPublicKey()), auth: toBase64Url(auth) };
  const text = JSON.stringify({ title: 'À toi de jouer !', body: 'Tes amis t’attendent 🃏' });
  const a = await encryptPayload(new TextEncoder().encode(text), keys);
  const b = await encryptPayload(new TextEncoder().encode(text), keys);
  assert.equal(browserDecrypt(a, ua, auth), text);
  assert.equal(browserDecrypt(b, ua, auth), text);
  assert.notDeepEqual(a.subarray(0, 86), b.subarray(0, 86));
});

test('bad browser keys and overlong messages are refused', async () => {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const good = { p256dh: toBase64Url(ua.getPublicKey()), auth: toBase64Url(randomBytes(16)) };
  const msg = new TextEncoder().encode('x');
  await assert.rejects(encryptPayload(msg, { ...good, p256dh: toBase64Url(randomBytes(64)) }));
  await assert.rejects(encryptPayload(msg, { ...good, auth: toBase64Url(randomBytes(8)) }));
  await assert.rejects(encryptPayload(new Uint8Array(4000), good), /trop long/);
});

test('the VAPID token is a valid ES256 JWT for the push service', async () => {
  const keys = await generateVapidKeys();
  assert.equal(fromBase64Url(keys.publicKey).length, 65);
  assert.equal(keys.privateJwk.crv, 'P-256');
  const now = Date.UTC(2026, 9, 8, 12);
  const header = await vapidAuthorization(
    'https://fcm.googleapis.com/fcm/send/abc:def',
    keys,
    'https://example.org/',
    now,
  );
  const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
  assert.ok(match);
  const [, h, c, sig, k] = match;
  assert.equal(k, keys.publicKey);
  assert.deepEqual(JSON.parse(Buffer.from(fromBase64Url(h)).toString()), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(Buffer.from(fromBase64Url(c)).toString());
  assert.deepEqual(claims, {
    aud: 'https://fcm.googleapis.com',
    exp: now / 1000 + 12 * 3600,
    sub: 'https://example.org/',
  });
  const raw = fromBase64Url(keys.publicKey);
  const pub = createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: toBase64Url(raw.slice(1, 33)), y: toBase64Url(raw.slice(33)) },
    format: 'jwk',
  });
  const signature = Buffer.from(fromBase64Url(sig));
  assert.equal(signature.length, 64);
  assert.ok(verify('sha256', Buffer.from(`${h}.${c}`), { key: pub, dsaEncoding: 'ieee-p1363' }, signature));
});

test('a push request has the standard headers', async () => {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  const keys = await generateVapidKeys();
  const req = await buildPushRequest(
    {
      endpoint: 'https://web.push.apple.com/QGuQyavXut',
      keys: { p256dh: toBase64Url(ua.getPublicKey()), auth: toBase64Url(auth) },
    },
    '{"title":"Salut"}',
    keys,
    'https://example.org/',
    { ttl: 300, urgency: 'high', topic: 'turn-ABC123' },
  );
  assert.equal(req.url, 'https://web.push.apple.com/QGuQyavXut');
  assert.equal(req.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(req.headers.TTL, '300');
  assert.equal(req.headers.Urgency, 'high');
  assert.equal(req.headers.Topic, 'turn-ABC123');
  assert.match(req.headers.Authorization, /^vapid t=.+, k=/);
  assert.equal(browserDecrypt(req.body, ua, auth), '{"title":"Salut"}');
});
