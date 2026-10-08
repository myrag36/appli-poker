import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * The website can be installed on a phone's home screen like an app (PWA): this registers
 * the service worker (public/sw.js) and tells the install banner what it can offer.
 */

/** Chrome's install prompt event, not in the DOM typings. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'appli-poker:install-dismissed';
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

let promptEvent: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function isStandalone() {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** iPhone and iPad (iPadOS says it is a Mac, but has a touch screen): no install prompt there. */
export function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

if (isWeb) {
  // Chrome fires this early, often before the games screen is shown: keep it for later.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptEvent = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    promptEvent = null;
    notify();
  });
}

/** Registers the service worker, only for the published site (not while developing). */
export function registerServiceWorker() {
  if (!isWeb || __DEV__ || !('serviceWorker' in navigator)) return;
  const base = `${process.env.EXPO_BASE_URL ?? ''}/`;
  const register = () =>
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // The app works without it, just not offline.
    });
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/**
 * What the install banner can offer:
 * - 'prompt': the browser can install the app itself (Android, Chrome, Edge);
 * - 'ios': Safari has no button for it, so we explain how to do it by hand;
 * - null: nothing to show (already installed, dismissed, or not possible here).
 */
export type InstallMode = 'prompt' | 'ios' | null;

export function useInstall() {
  const [, refresh] = useState(0);
  const [dismissed, setDismissed] = useState(() => isWeb && wasDismissed());

  useEffect(() => {
    if (!isWeb) return;
    const listener = () => refresh((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  let mode: InstallMode = null;
  if (isWeb && !dismissed && !installed && !isStandalone()) {
    if (promptEvent) mode = 'prompt';
    else if (isIos()) mode = 'ios';
  }

  /** Opens the browser's install window; true when the app was installed. */
  async function install() {
    const event = promptEvent;
    if (!event) return false;
    promptEvent = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    notify();
    return outcome === 'accepted';
  }

  /** Hides the banner for good on this browser. */
  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage blocked: hidden until the next visit only.
    }
    setDismissed(true);
  }

  return { mode, install, dismiss };
}
