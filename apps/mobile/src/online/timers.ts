import { useEffect, useState } from 'react';
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

/**
 * The current time, for turn timers counting down to `deadline` in whole seconds: it moves
 * when the number of seconds left changes, not several times a second for nothing (each move
 * redraws the whole table). Once the deadline has passed, it moves every `overdueMs`.
 */
export function useDeadlineClock(deadline: number | null, overdueMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const at = Date.now();
      setNow(at);
      const left = deadline - at;
      // Just after the next whole second left (a few ms late, never early).
      timer = setTimeout(step, left > 0 ? (left % 1000 || 1000) + 5 : overdueMs);
    };
    step();
    return () => clearTimeout(timer);
  }, [deadline, overdueMs]);
  return now;
}
