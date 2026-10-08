// Sends Web Push notifications from the Edge Functions. A failure is logged but never undoes a move.
//
// The VAPID key pair is made by the server itself the first time it is needed and kept in the
// private table push_keys, which only the service role can read: no person ever sees or handles
// the private key, and it is never logged nor sent anywhere.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { type VapidKeys, buildPushRequest, generateVapidKeys } from './webpush.ts';
import { type Notice, type NoticeLang, cleanLang, noticePayload, subscriptionGone } from './notify.ts';

/** Who sends the notifications, for the push services (RFC 8292 asks for a URL or an e-mail). */
const SUBJECT = 'https://myrag36.github.io/appli-poker/';

let cached: VapidKeys | null = null;

async function readKeys(db: SupabaseClient): Promise<VapidKeys | null> {
  const { data, error } = await db
    .from('push_keys')
    .select('public_key, private_jwk')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data ? { publicKey: data.public_key as string, privateJwk: data.private_jwk as JsonWebKey } : null;
}

/** The server's key pair, made and saved on first use. */
export async function vapidKeys(db: SupabaseClient): Promise<VapidKeys> {
  if (cached) return cached;
  let keys = await readKeys(db);
  if (!keys) {
    const fresh = await generateVapidKeys();
    const { error } = await db
      .from('push_keys')
      .insert({ id: 1, public_key: fresh.publicKey, private_jwk: fresh.privateJwk });
    // Another request made the keys at the same moment: use theirs.
    if (error && error.code !== '23505')
      throw new Error(`clés de notification non enregistrées (${error.code})`);
    keys = await readKeys(db);
    if (!keys) throw new Error('clés de notification introuvables');
  }
  cached = keys;
  return keys;
}

/** Sends a notification to every device of these players, each in its own language. */
export async function notify(
  db: SupabaseClient,
  userIds: string[],
  build: (lang: NoticeLang) => Notice,
  options: { ttl?: number; urgency?: 'normal' | 'high' } = {},
): Promise<number> {
  if (userIds.length === 0) return 0;
  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, lang')
    .in('user_id', userIds);
  if (error) throw error;
  if (!subs?.length) return 0;
  const keys = await vapidKeys(db);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      const notice = build(cleanLang(s.lang));
      try {
        const req = await buildPushRequest(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          noticePayload(notice),
          keys,
          SUBJECT,
          { ttl: options.ttl, urgency: options.urgency, topic: notice.tag },
        );
        const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
        await res.body?.cancel();
        if (res.ok) sent++;
        else if (subscriptionGone(res.status)) {
          await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        } else console.error('notification refusée', res.status, new URL(s.endpoint).host);
      } catch (e) {
        console.error('notification non envoyée', (e as Error).message);
      }
    }),
  );
  return sent;
}

/** Lets the reply go out at once while notifications are still being sent. */
export function inBackground(job: Promise<unknown>) {
  const safe = job.catch((e) => console.error('notifications', (e as Error)?.message ?? e));
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(safe);
  return safe;
}
