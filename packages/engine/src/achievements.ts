// Daily streaks, chests and achievements: more reasons to come back and play.
import { type GameCounters, type ProgressGame, levelFromXp } from './progress.ts';

/** Coins for the first game of the day, growing with the streak of days in a row (capped at 7). */
export function streakCoins(streak: number): number {
  return 10 * Math.max(1, Math.min(7, streak));
}

/** Every 7th day in a row gives a big chest. */
export const STREAK_CHEST_EVERY = 7;

export type ChestKind = 'normal' | 'grand';

export interface Chest {
  id: string;
  kind: ChestKind;
  /** Why it was given: 'niveau', 'quetes', 'serie'. */
  reason: string;
}

export const CHEST_NAMES: Record<ChestKind, string> = { normal: 'Coffre', grand: 'Grand coffre' };
export const CHEST_REASONS: Record<string, string> = {
  niveau: 'Niveau supérieur',
  quetes: 'Toutes les quêtes du jour',
  serie: '7 jours d’affilée',
  podium: 'Podium de la semaine',
  tournoi: 'Champion du tournoi',
};

/** What a chest holds: coins, and sometimes a shop item the player does not have yet. */
export function rollChest(kind: ChestKind, rnd: () => number): { coins: number; item: boolean } {
  if (kind === 'grand') return { coins: 100 + Math.floor(rnd() * 16) * 10, item: rnd() < 0.5 };
  return { coins: 30 + Math.floor(rnd() * 6) * 10, item: rnd() < 0.15 };
}

/** Rare moments spotted during a game, worth a badge. */
export type Feat = 'yams' | 'capot' | 'blackjack' | 'president' | 'carre' | 'puissance4' | 'bataille';
export const FEATS: Feat[] = ['yams', 'capot', 'blackjack', 'president', 'carre', 'puissance4', 'bataille'];

/** Everything achievements are measured on. */
export interface AchievementStats {
  games: GameCounters;
  xp: number;
  bestStreak: number;
  owned: number;
  questsDone: number;
  feats: string[];
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  text: string;
  target: number;
  coins: number;
}

const played = (s: AchievementStats) => Object.values(s.games).reduce((a, c) => a + (c?.played ?? 0), 0);
const won = (s: AchievementStats) => Object.values(s.games).reduce((a, c) => a + (c?.won ?? 0), 0);
const wonIn = (s: AchievementStats, g: ProgressGame) => s.games[g]?.won ?? 0;

interface Def extends Achievement {
  measure: (s: AchievementStats) => number;
}

const def = (
  id: string,
  icon: string,
  name: string,
  text: string,
  target: number,
  coins: number,
  measure: (s: AchievementStats) => number,
): Def => ({ id, icon, name, text, target, coins, measure });

const feat = (id: Feat, icon: string, name: string, text: string, coins: number) =>
  def(`feat-${id}`, icon, name, text, 1, coins, (s) => (s.feats.includes(id) ? 1 : 0));

const DEFS: Def[] = [
  def('first-win', '🏅', 'Première victoire', 'Gagne ta première partie', 1, 30, won),
  def('played-10', '🎮', 'Habitué', 'Joue 10 parties', 10, 50, played),
  def('played-50', '🎲', 'Pilier de comptoir', 'Joue 50 parties', 50, 100, played),
  def('played-200', '🏛️', 'Légende du salon', 'Joue 200 parties', 200, 300, played),
  def('won-10', '🥉', 'Gagnant', 'Gagne 10 parties', 10, 60, won),
  def('won-50', '🥈', 'Champion', 'Gagne 50 parties', 50, 150, won),
  def('won-150', '🥇', 'Invincible', 'Gagne 150 parties', 150, 400, won),
  def(
    'all-games',
    '🧭',
    'Touche-à-tout',
    'Joue au moins une partie de 5 jeux différents',
    5,
    80,
    (s) => Object.values(s.games).filter((c) => (c?.played ?? 0) > 0).length,
  ),
  def('poker-10', '🃏', 'Requin du poker', 'Gagne 10 parties de poker', 10, 100, (s) => wonIn(s, 'poker')),
  def('yams-10', '🎲', 'Roi du Yams', 'Gagne 10 parties de Yams', 10, 100, (s) => wonIn(s, 'yams')),
  def('belote-10', '♠️', 'As de la belote', 'Gagne 10 parties de belote', 10, 100, (s) => wonIn(s, 'belote')),
  def('blackjack-10', '🂡', 'Compteur de cartes', 'Gagne 10 parties de blackjack', 10, 100, (s) =>
    wonIn(s, 'blackjack'),
  ),
  def('president-10', '👑', 'Chef d’État', 'Gagne 10 parties de Président', 10, 100, (s) =>
    wonIn(s, 'president'),
  ),
  def('perudo-10', '🗣️', 'Menteur de génie', 'Gagne 10 parties de Perudo', 10, 100, (s) =>
    wonIn(s, 'perudo'),
  ),
  def('level-10', '⭐', 'Niveau 10', 'Atteins le niveau 10', 10, 100, (s) => levelFromXp(s.xp)),
  def('level-25', '🌟', 'Niveau 25', 'Atteins le niveau 25', 25, 250, (s) => levelFromXp(s.xp)),
  def('level-50', '💫', 'Niveau 50', 'Atteins le niveau maximum', 50, 600, (s) => levelFromXp(s.xp)),
  def('streak-3', '🔥', 'En forme', 'Joue 3 jours d’affilée', 3, 50, (s) => s.bestStreak),
  def('streak-7', '🔥', 'Accro', 'Joue 7 jours d’affilée', 7, 120, (s) => s.bestStreak),
  def('streak-30', '☄️', 'Inarrêtable', 'Joue 30 jours d’affilée', 30, 500, (s) => s.bestStreak),
  def('quests-10', '📜', 'Aventurier', 'Termine 10 quêtes', 10, 80, (s) => s.questsDone),
  def('quests-50', '🗺️', 'Grand aventurier', 'Termine 50 quêtes', 50, 250, (s) => s.questsDone),
  def('shop-3', '🛍️', 'Coquet', 'Achète 3 articles à la boutique', 3, 60, (s) => s.owned),
  def('shop-15', '💎', 'Collectionneur', 'Achète 15 articles à la boutique', 15, 300, (s) => s.owned),
  feat('yams', '🎯', 'Yams !', 'Fais un Yams (5 dés pareils)', 60),
  feat('capot', '🧹', 'Capot', 'Remporte tous les plis d’une donne à la belote', 80),
  feat('blackjack', '🂱', 'Blackjack', 'Fais 21 avec tes deux premières cartes', 40),
  feat('president', '🎩', 'Président', 'Finis premier d’une manche de Président', 40),
  feat('carre', '🍀', 'Carré gagnant', 'Gagne un coup de poker avec un carré ou mieux', 100),
  feat('puissance4', '🔴', 'Aligné', 'Gagne une partie de Puissance 4', 40),
  feat('bataille', '⚓', 'Amiral', 'Gagne une partie de bataille navale', 60),
];

/** Every achievement, in display order. */
export const ACHIEVEMENTS: Achievement[] = DEFS.map(({ measure: _m, ...a }) => a);

export function findAchievement(id: unknown): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** How far a player is in an achievement, from 0 to its target. */
export function achievementProgress(id: string, stats: AchievementStats): number {
  const d = DEFS.find((x) => x.id === id);
  return d ? Math.min(d.target, d.measure(stats)) : 0;
}
