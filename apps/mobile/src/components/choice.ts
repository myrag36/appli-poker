import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * One cosmetic choice (chips, felt…) kept in the browser so the tables look right before the
 * profile loads, and shared by every component that draws it.
 */
export function makeChoice(key: string, ids: readonly string[], fallback: string) {
  const listeners = new Set<() => void>();
  let current = fallback;
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(key);
      if (saved && ids.includes(saved)) current = saved;
    }
  } catch {
    // Storage can be blocked: keep the default.
  }
  const get = () => current;
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  return {
    get,
    /** Changes the choice everywhere. Unknown ids are ignored. */
    set(id: string) {
      if (!ids.includes(id) || id === current) return;
      current = id;
      try {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(key, id);
      } catch {
        // The choice lasts until the app closes.
      }
      listeners.forEach((l) => l());
    },
    /** The current choice; re-renders when it changes. */
    use: () => useSyncExternalStore(subscribe, get, get),
  };
}
