// The daily challenge ("Défi du jour"): one harder objective a day, the same for everyone,
// worth about three quests. It builds on the day stats the servers keep for the quests.
import type { GameCounters, ProgressGame } from './progress.ts';
import type { DayStats } from './quests.ts';

export interface Challenge {
  /** Stable for the day, e.g. "wingame:tarot", "discover". */
  id: string;
  /** French text, also the translation key. */
  text: string;
  /** One-line hint under the text (French, translation key), or ''. */
  hint: string;
  emoji: string;
  target: number;
  coins: number;
}

/** Extra coins per day of challenge streak (from the 2nd day), up to this many days. */
export const CHALLENGE_STREAK_STEP = 20;
export const CHALLENGE_STREAK_MAX = 5;

/** Bonus coins on top of the challenge for a streak of `days` challenges in a row (this one included). */
export function challengeStreakBonus(days: number): number {
  return CHALLENGE_STREAK_STEP * Math.max(0, Math.min(CHALLENGE_STREAK_MAX, days - 1));
}

// Kept fixed so that adding a game never changes the challenge of a day already started.
export const CHALLENGE_GAMES: ProgressGame[] = [
  'poker',
  'blackjack',
  'president',
  'yams',
  'belote',
  'puissance4',
  'rami',
  'uno',
  'huit',
  'tarot',
];

const NAMES: Record<ProgressGame, { label: string; emoji: string }> = {
  poker: { label: 'de poker', emoji: '♠️' },
  blackjack: { label: 'de blackjack', emoji: '🃏' },
  president: { label: 'de Président', emoji: '👑' },
  yams: { label: 'de Yams', emoji: '🎲' },
  belote: { label: 'de belote', emoji: '♥️' },
  puissance4: { label: 'de Puissance 4', emoji: '🔴' },
  bataille: { label: 'de bataille navale', emoji: '🚢' },
  rami: { label: 'de rami', emoji: '🎴' },
  uno: { label: 'de Uno', emoji: '🌈' },
  huit: { label: 'de 8 américain', emoji: '🎱' },
  tarot: { label: 'de tarot', emoji: '🔮' },
};

/** Days since 1970-01-01 for a "YYYY-MM-DD" day. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

const DISCOVER: Omit<Challenge, 'id'> = {
  text: 'Essaie un jeu auquel tu n’as jamais joué',
  hint: 'Tu as déjà tout essayé ? Joue à 3 jeux différents.',
  emoji: '🧭',
  target: 1,
  coins: 150,
};

const GLOBAL: Challenge[] = [
  { id: 'discover', ...DISCOVER },
  { id: 'win:4', text: 'Gagne 4 parties', hint: '', emoji: '🏆', target: 4, coins: 210 },
  { id: 'variety:5', text: 'Joue à 5 jeux différents', hint: '', emoji: '🎪', target: 5, coins: 200 },
  { id: 'winvariety:3', text: 'Gagne dans 3 jeux différents', hint: '', emoji: '🌟', target: 3, coins: 210 },
  {
    id: 'rounds:30',
    text: 'Joue 30 mains ou manches en ligne',
    hint: '',
    emoji: '🌐',
    target: 30,
    coins: 180,
  },
];

/**
 * The challenge of a day ("2026-10-08"). Two days out of three are about one game, the games
 * taking turns so each comes back every ten such days; the third is a general challenge.
 */
export function challengeFor(day: string): Challenge {
  const n = dayNumber(day);
  if (n % 3 === 2) return GLOBAL[Math.floor(n / 3) % GLOBAL.length];
  const k = n - Math.floor(n / 3) - 1; // counts only the game days
  const game = CHALLENGE_GAMES[(((k * 3) % 10) + 10) % 10]; // steps of 3 visit all ten games
  const { label, emoji } = NAMES[game];
  return Math.floor(k / 10) % 2 === 0
    ? { id: `wingame:${game}`, text: `Gagne 2 parties ${label}`, hint: '', emoji, target: 2, coins: 180 }
    : { id: `playgame:${game}`, text: `Joue 4 parties ${label}`, hint: '', emoji, target: 4, coins: 150 };
}

/**
 * How far a player is in a challenge, from 0 to its target. `games` are the all-time
 * counters (they already include today's games), needed for "discover".
 */
export function challengeProgress(c: Challenge, stats: DayStats, games: GameCounters = {}): number {
  const [kind, arg] = c.id.split(':');
  const playedToday = (g: string) => stats.played?.[g as ProgressGame] ?? 0;
  let done = 0;
  if (kind === 'wingame') done = stats.won?.[arg as ProgressGame] ?? 0;
  else if (kind === 'playgame') done = playedToday(arg);
  else if (kind === 'win') done = Object.values(stats.won ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  else if (kind === 'variety') done = Object.values(stats.played ?? {}).filter((x) => (x ?? 0) > 0).length;
  else if (kind === 'winvariety') done = Object.values(stats.won ?? {}).filter((x) => (x ?? 0) > 0).length;
  else if (kind === 'rounds') done = stats.rounds ?? 0;
  else if (kind === 'discover') {
    // A game whose every game played so far was today is a game tried for the first time.
    const firstToday = CHALLENGE_GAMES.some(
      (g) => playedToday(g) > 0 && (games[g]?.played ?? 0) <= playedToday(g),
    );
    const leftToTry = CHALLENGE_GAMES.some((g) => (games[g]?.played ?? 0) - playedToday(g) <= 0);
    const variety = CHALLENGE_GAMES.filter((g) => playedToday(g) > 0).length;
    done = firstToday || (!leftToTry && variety >= 3) ? 1 : 0;
  }
  return Math.min(done, c.target);
}

/** Days in a row the challenge was taken, still counted if the last one was yesterday. */
export function liveChallengeStreak(
  lastDay: string | null | undefined,
  streak: number,
  today: string,
): number {
  if (!lastDay) return 0;
  const gap = dayNumber(today) - dayNumber(lastDay);
  return gap === 0 || gap === 1 ? streak : 0;
}
