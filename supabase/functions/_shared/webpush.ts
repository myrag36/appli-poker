// Standard Web Push (RFC 8030) with VAPID (RFC 8292) and aes128gcm payloads (RFC 8291, RFC 8188),
// written with Web Crypto only so it runs the same in Deno (Edge Functions) and in Node (tests).

export interface PushSubscriptionKeys {
  /** The browser's public key, base64url (65 bytes, uncompressed P-256 point). */
  p256dh: string;
  /** The browser's authentication secret, base64url (16 bytes). */
  auth: string;
}

export interface PushTarget {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

/** The server's VAPID key pair: the public key goes to browsers, the private one never leaves the server. */
export interface VapidKeys {
  /** Uncompressed P-256 public key, base64url (what `applicationServerKey` expects). */
  publicKey: string;
  /** The private key as a JWK (kty EC, crv P-256, with `d`). */
  privateJwk: JsonWebKey;
}

export interface PushRequest {
  url: string;
  headers: Record<string, string>;
  body: Uint8Array;
}

const enc = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A new VAPID key pair, made on the server the first time it is needed. */
export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: toBase64Url(raw), privateJwk };
}

/** The `Authorization` header that proves to the push service this server sent the message. */
export async function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  now: number,
): Promise<string> {
  const header = toBase64Url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toBase64Url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        // Push services refuse tokens valid for more than 24 hours.
        exp: Math.floor(now / 1000) + 12 * 3600,
        sub: subject,
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    'jwk',
    { ...keys.privateJwk, key_ops: ['sign'], ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // Web Crypto gives the raw r||s signature that JWT's ES256 expects.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)),
  );
  return `vapid t=${header}.${claims}.${toBase64Url(signature)}, k=${keys.publicKey}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8),
  );
}

/** Fixed inputs, so tests can check the output against known values. */
export interface EncryptOptions {
  salt?: Uint8Array;
  serverKeys?: CryptoKeyPair;
}

/**
 * Encrypts a message for one browser (RFC 8291): a single aes128gcm record whose header carries
 * the salt and this message's own public key.
 */
export async function encryptPayload(
  payload: Uint8Array,
  keys: PushSubscriptionKeys,
  options: EncryptOptions = {},
): Promise<Uint8Array> {
  const uaPublic = fromBase64Url(keys.p256dh);
  const authSecret = fromBase64Url(keys.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Clé du navigateur invalide');
  if (authSecret.length !== 16) throw new Error('Secret du navigateur invalide');
  // 4096 bytes per record, minus the 16-byte tag and the 1-byte delimiter.
  if (payload.length > 3993) throw new Error('Message trop long');

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const server =
    options.serverKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', server.publicKey));
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaKey } as EcdhKeyDeriveParams,
      server.privateKey,
      256,
    ),
  );

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02 marks the last (and only) record.
  const plain = concat(payload, new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

export interface SendOptions {
  /** Seconds the push service keeps the message while the phone is offline. */
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  /** Messages with the same topic replace each other while waiting at the push service. */
  topic?: string;
  now?: number;
}

/** Everything needed to POST one message to a browser's push service. */
export async function buildPushRequest(
  target: PushTarget,
  message: string,
  keys: VapidKeys,
  subject: string,
  options: SendOptions = {},
): Promise<PushRequest> {
  const body = await encryptPayload(enc.encode(message), target.keys);
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(target.endpoint, keys, subject, options.now ?? Date.now()),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttl ?? 3600),
    Urgency: options.urgency ?? 'normal',
  };
  if (options.topic) headers.Topic = options.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  return { url: target.endpoint, headers, body };
}
