// Coins and daily quests. Coins buy the shop items; quests change every day (Paris time).
import type { ProgressGame } from './progress.ts';

/** Coins for one finished game, and extra when it is won. */
export const COINS_PLAY = 10;
export const COINS_WIN = 15;

/** What a player did today, kept by the servers to check quests. */
export interface DayStats {
  played?: Partial<Record<ProgressGame, number>>;
  won?: Partial<Record<ProgressGame, number>>;
  /** Online rounds and poker hands. */
  rounds?: number;
}

export interface Quest {
  /** Stable for the day, stored once the reward is claimed. */
  id: string;
  text: string;
  target: number;
  coins: number;
}

// Kept fixed so that adding a game never changes the quests of a day already started.
const QUEST_GAMES: ProgressGame[] = ['poker', 'blackjack', 'president', 'yams', 'belote'];

const GAME_LABELS: Partial<Record<ProgressGame, string>> = {
  poker: 'de poker',
  blackjack: 'de blackjack',
  president: 'de Président',
  yams: 'de Yams',
  belote: 'de belote',
  puissance4: 'de Puissance 4',
  rami: 'de rami',
  uno: 'de Uno',
  huit: 'de 8 américain',
  tarot: 'de tarot',
};

const sum = (counts: Partial<Record<ProgressGame, number>> | undefined) =>
  Object.values(counts ?? {}).reduce((a, b) => a + (b ?? 0), 0);

/** How far a player is in a quest, from 0 to its target. */
export function questProgress(quest: Quest, stats: DayStats): number {
  const [kind, arg] = quest.id.split(':');
  let done = 0;
  if (kind === 'play') done = sum(stats.played);
  else if (kind === 'win') done = sum(stats.won);
  else if (kind === 'playgame') done = stats.played?.[arg as ProgressGame] ?? 0;
  else if (kind === 'wingame') done = stats.won?.[arg as ProgressGame] ?? 0;
  else if (kind === 'variety') done = Object.values(stats.played ?? {}).filter((n) => (n ?? 0) > 0).length;
  else if (kind === 'rounds') done = stats.rounds ?? 0;
  return Math.min(done, quest.target);
}

function quest(kind: string, arg: string | number, text: string, target: number, coins: number): Quest {
  return { id: `${kind}:${arg}`, text, target, coins };
}

/** Small deterministic generator so everybody gets the same quests on the same day. */
function seeded(day: string) {
  let a = 0;
  for (const ch of day) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The three quests of a day ("2026-10-07"): an easy one, one about a game, a harder one. */
export function questsFor(day: string): Quest[] {
  const rnd = seeded(day);
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const easy = pick([quest('play', 3, 'Joue 3 parties', 3, 40), quest('play', 5, 'Joue 5 parties', 5, 60)]);
  const game = pick(QUEST_GAMES);
  const focused =
    rnd() < 0.5
      ? quest('playgame', game, `Joue 2 parties ${GAME_LABELS[game]}`, 2, 40)
      : quest('wingame', game, `Gagne une partie ${GAME_LABELS[game]}`, 1, 60);
  const hard = pick([
    quest('win', 2, 'Gagne 2 parties', 2, 70),
    quest('variety', 3, 'Joue à 3 jeux différents', 3, 70),
    quest('rounds', 15, 'Joue 15 mains ou manches en ligne', 15, 60),
  ]);
  return [easy, focused, hard];
}

/** Today's date in Paris, the day quests and daily bonuses follow. */
export function parisDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
