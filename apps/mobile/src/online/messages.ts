// Texts written by the game engine or the servers, which are in French and may hold numbers.
import { t } from '../i18n';

/** French texts with numbers in them, as the engine and the servers build them. */
const TEMPLATES = [
  // Poker: what each player did last, shown by their seat.
  'P. blinde {n}',
  'G. blinde {n}',
  'Suit {n}',
  'Mise {n}',
  'Relance à {n}',
  // Errors.
  'La relance doit être entre {min} et {max}',
  'Mise entre {min} et {max}',
  'Choisis {n} carte',
  'Choisis {n} cartes',
  'Il faut au moins {n} points pour ouvrir (tu en as {points})',
  'Ouvre d’abord avec {n} points',
  'Il faut de {min} à {max} joueurs',
  // Poker: the end of a hand, as written in its log.
  '{name} remporte {n} ({hand})',
  '{name} remporte {n}',
];

const PATTERNS = TEMPLATES.map((template) => {
  const names: string[] = [];
  const source = template
    .split(/(\{\w+\})/)
    .map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      if (name) {
        names.push(name);
        return name === 'name' || name === 'hand' ? '(.+?)' : '(-?\\d+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return { template, names, regex: new RegExp(`^${source}$`) };
});

/** Translates a text from the engine or a server, including the ones with numbers in them. */
export function tMessage(fr: string): string {
  for (const { template, names, regex } of PATTERNS) {
    const match = regex.exec(fr);
    if (!match) continue;
    // Hand names ("Paire"…) are translated too; player names stay as they are.
    const vars = names.map((name, i) => [name, name === 'hand' ? t(match[i + 1]) : match[i + 1]]);
    return t(template, Object.fromEntries(vars));
  }
  return t(fr);
}
