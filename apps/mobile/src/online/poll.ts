import { AppState, Platform } from 'react-native';

const web = Platform.OS === 'web' && typeof document !== 'undefined';

function visible(): boolean {
  if (web) return document.visibilityState !== 'hidden';
  return AppState.currentState === 'active';
}

/**
 * Calls `refresh` every `ms` while the app is on screen: nothing is downloaded for a hidden tab
 * or a phone in a pocket. Coming back calls it at once, so the screen is up to date right away.
 * Returns the function that stops it.
 */
export function pollWhileVisible(refresh: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const start = () => {
    if (timer === null) timer = setInterval(refresh, ms);
  };
  const stop = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const update = () => {
    if (!visible()) return stop();
    if (timer === null) {
      refresh();
      start();
    }
  };
  if (visible()) start();
  if (web) {
    document.addEventListener('visibilitychange', update);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', update);
    };
  }
  const sub = AppState.addEventListener('change', update);
  return () => {
    stop();
    sub.remove();
  };
}
