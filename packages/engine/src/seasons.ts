// A theme for every month, with three items for sale only that month.
import { parisDay } from './quests.ts';

export interface Season {
  month: number;
  name: string;
  emoji: string;
  /** Two colors for the season's card. */
  colors: [string, string];
}

export const SEASONS: Season[] = [
  { month: 1, name: 'Grand froid', emoji: '❄️', colors: ['#7fb8e6', '#1f4e79'] },
  { month: 2, name: 'Carnaval', emoji: '🎭', colors: ['#ff5fa2', '#5b2a86'] },
  { month: 3, name: 'Printemps', emoji: '🌷', colors: ['#9be37b', '#2f7d4f'] },
  { month: 4, name: 'Poisson d’avril', emoji: '🐟', colors: ['#5fd3e6', '#1b5f8a'] },
  { month: 5, name: 'Fête des fleurs', emoji: '🌸', colors: ['#ffb3d1', '#a8457a'] },
  { month: 6, name: 'Fête de la musique', emoji: '🎸', colors: ['#ff7b54', '#5a1f6b'] },
  { month: 7, name: 'Plage', emoji: '🏖️', colors: ['#ffd36b', '#1e88b8'] },
  { month: 8, name: 'Étoiles filantes', emoji: '🌠', colors: ['#6b7bff', '#120b3d'] },
  { month: 9, name: 'Rentrée', emoji: '📚', colors: ['#f2c14e', '#2d5a3d'] },
  { month: 10, name: 'Halloween', emoji: '🎃', colors: ['#ff8c1a', '#2a0f3d'] },
  { month: 11, name: 'Automne', emoji: '🍂', colors: ['#e0803a', '#5a2a12'] },
  { month: 12, name: 'Noël', emoji: '🎄', colors: ['#e63946', '#14532d'] },
];

/** The month (1-12) of a Paris day "YYYY-MM-DD". */
export function monthOf(day: string = parisDay()): number {
  return Number(day.slice(5, 7));
}

export function seasonOf(day: string = parisDay()): Season {
  return SEASONS[monthOf(day) - 1];
}

/** Days left in the season, today included. */
export function seasonDaysLeft(day: string = parisDay()): number {
  const [y, m, d] = day.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return last - d + 1;
}

/** Monday of the week of a day, the start of the weekly ranking. */
export function weekStart(day: string = parisDay()): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const back = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}
