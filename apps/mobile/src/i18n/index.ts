// The app is written in French; other languages translate each French text.
// `t('Niveau {n}', { n: 3 })` gives "Niveau 3" in French and "Level 3" in English.
// The language is read once at startup, like the theme, so module-level texts work too: the
// English texts are a separate download, and the app only starts once they are there (index.ts).
import { Platform } from 'react-native';

export type Lang = 'fr' | 'en';
export const LANGS: { id: Lang; name: string; flag: string }[] = [
  { id: 'fr', name: 'Français', flag: '🇫🇷' },
  { id: 'en', name: 'English', flag: '🇬🇧' },
];

const LANG_KEY = 'appli-poker-langue';
const DICTS: Record<Lang, Record<string, string> | null> = { fr: null, en: null };

function initialLang(): Lang {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'fr';
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    // Private mode: fall back to the phone's language.
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr';
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export const lang: Lang = initialLang();

/** Resolves once the texts of the chosen language are loaded (at once in French). */
export const langReady: Promise<void> =
  lang === 'en'
    ? import('./en').then(
        (m) => {
          DICTS.en = m.EN;
        },
        () => {
          // Not downloaded (offline before it was ever saved): the app opens in French.
        },
      )
    : Promise.resolve();

/** Saves the choice and restarts the app in that language. */
export function setLang(next: Lang) {
  if (next === lang || Platform.OS !== 'web') return;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // Nothing saved: the reload keeps the phone's language.
  }
  window.location.reload();
}

/** Translates a French text, then fills in `{name}` placeholders. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[lang];
  let out = (dict && dict[fr]) || fr;
  if (vars) for (const k in vars) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}

/** Picks the singular or plural French text, then translates it. */
export function tn(n: number, one: string, many: string, vars?: Record<string, string | number>): string {
  return t(Math.abs(n) <= 1 ? one : many, { n, ...vars });
}

/** Dates and numbers in the chosen language. */
export const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
