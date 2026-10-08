import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { callProfile } from './online/supabase';
import { isIos, isStandalone } from './pwa';
import { lang } from './i18n';

/**
 * Web Push notifications (installed web app): a friend invites me to their table, or it is my
 * turn while the app is in the background. The browser asks for permission only after a tap.
 *
 * - 'on': this browser receives notifications;
 * - 'off': possible, not turned on yet (or turned off);
 * - 'denied': the person blocked them in the browser's settings;
 * - 'needs-install': iPhone and iPad only get them once the app is on the home screen (iOS 16.4+);
 * - 'unsupported': this browser cannot receive them.
 */
export type PushStatus = 'on' | 'off' | 'denied' | 'needs-install' | 'unsupported';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const PROMPT_KEY = 'appli-poker:notify-prompt-dismissed';

function hasPush() {
  return isWeb && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** What this browser allows, without asking anything. */
export function pushSupport(): 'ok' | 'needs-install' | 'unsupported' {
  if (!isWeb) return 'unsupported';
  // Safari on iPhone has no notifications in a tab, only for apps added to the home screen.
  if (isIos() && !isStandalone()) return 'needs-install';
  return hasPush() ? 'ok' : 'unsupported';
}

function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function sameKey(current: ArrayBuffer | null | undefined, publicKey: string) {
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = base64UrlToBytes(publicKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** The service worker that receives the notifications (registered here too while developing). */
async function worker(): Promise<ServiceWorkerRegistration> {
  const base = `${process.env.EXPO_BASE_URL ?? ''}/`;
  const reg =
    (await navigator.serviceWorker.getRegistration(base)) ??
    (await navigator.serviceWorker.register(`${base}sw.js`, { scope: base }));
  if (reg.active) return reg;
  return await navigator.serviceWorker.ready;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(`${process.env.EXPO_BASE_URL ?? ''}/`);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  const support = pushSupport();
  if (support !== 'ok') return support;
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  try {
    return (await currentSubscription()) ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

const listeners = new Set<(s: PushStatus) => void>();
const announce = (s: PushStatus) => listeners.forEach((l) => l(s));

/** Sends this browser's subscription to the server, in the app's language. */
async function register(sub: PushSubscription) {
  await callProfile({ type: 'pushSubscribe', subscription: sub.toJSON(), lang });
}

/**
 * Turns notifications on. Call it straight from a tap: browsers (Safari above all) only show
 * their permission question in answer to a gesture.
 */
export async function enablePush(): Promise<PushStatus> {
  if (pushSupport() !== 'ok') return pushStatus();
  // First, before anything else is awaited, so the tap still counts.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    const status: PushStatus = permission === 'denied' ? 'denied' : 'off';
    announce(status);
    return status;
  }
  const [reg, { publicKey }] = await Promise.all([
    worker(),
    callProfile<{ publicKey: string }>({ type: 'pushKey' }),
  ]);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made for another server key cannot receive our messages.
  if (sub && !sameKey(sub.options.applicationServerKey, publicKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(publicKey) as BufferSource,
  });
  await register(sub);
  announce('on');
  return 'on';
}

export async function disablePush(): Promise<PushStatus> {
  const sub = await currentSubscription().catch(() => null);
  if (sub) {
    await callProfile({ type: 'pushUnsubscribe', endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => false);
  }
  const status = await pushStatus();
  announce(status);
  return status;
}

/**
 * At launch: keeps the server's copy of this browser's subscription up to date (language,
 * account, or a subscription the browser renewed on its own).
 */
export async function syncPush() {
  try {
    if ((await pushStatus()) !== 'on') return;
    const sub = await currentSubscription();
    if (sub) await register(sub);
  } catch {
    // Tried again at the next launch.
  }
}

/** The gentle prompt at a table is shown until the person answers it once. */
export function promptDismissed(): boolean {
  try {
    return localStorage.getItem(PROMPT_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPrompt() {
  try {
    localStorage.setItem(PROMPT_KEY, '1');
  } catch {
    // Shown again next time.
  }
}

/** The notification status, kept up to date, with the actions to change it. */
export function useNotifications() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    pushStatus().then((s) => live && setStatus(s));
    const listener = (s: PushStatus) => setStatus(s);
    listeners.add(listener);
    return () => {
      live = false;
      listeners.delete(listener);
    };
  }, []);

  async function run(action: () => Promise<PushStatus>) {
    setBusy(true);
    setError(null);
    try {
      setStatus(await action());
    } catch (e) {
      setError((e as Error).message);
      setStatus(await pushStatus());
    } finally {
      setBusy(false);
    }
  }

  return {
    status,
    busy,
    error,
    enable: () => run(enablePush),
    disable: () => run(disablePush),
  };
}
