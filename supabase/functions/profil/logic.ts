// Rules of the profile server, without database access so they can be tested on their own.
import {
  type AchievementStats,
  type ChestKind,
  COINS_PLAY,
  FEATS,
  type Feat,
  type GameCounters,
  achievementProgress,
  findAchievement,
  forSale,
  monthOf,
  rollChest,
  COINS_WIN,
  DEFAULT_EQUIPPED,
  type DayStats,
  type Equipped,
  PROGRESS_GAMES,
  type ProgressGame,
  type Quest,
  type RewardKind,
  SHOP_ITEMS,
  XP_PLAY,
  XP_WIN,
  cleanEquipped,
  cleanOwned,
  isUnlocked,
  levelFromXp,
  ownedKey,
  questProgress,
  questsFor,
  type Challenge,
  challengeFor,
  challengeProgress,
  type LeaderboardLine,
  type LeaderboardPlayer,
  type OnlineResult,
  leaderboardChest,
  leaderboardGames,
  leaderboardPodium,
  previousWeek,
  rankLeaderboard,
  tallyResults,
  weekEndsAt,
} from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';

const SLOTS: (keyof Equipped)[] = ['frame', 'title', 'cardBack', 'banner'];

/** Puts on a reward the player has unlocked or bought, keeping the rest of what they wear. */
export function equip(
  xp: number,
  current: unknown,
  slot: unknown,
  id: unknown,
  owned: unknown = [],
): Equipped {
  if (!SLOTS.includes(slot as keyof Equipped)) throw new GameError('Emplacement inconnu');
  const level = levelFromXp(xp);
  const kind = slot as keyof Equipped;
  const mine = cleanOwned(owned);
  if (!isUnlocked(kind, id, level, mine)) throw new GameError('Pas encore débloqué');
  return { ...cleanEquipped(current ?? DEFAULT_EQUIPPED, level, mine), [kind]: id as string };
}

/** Experience and coins asked for a game finished on one phone. */
export function localGame(
  game: unknown,
  won: unknown,
): { game: ProgressGame; amount: number; coins: number; won: boolean } {
  if (!PROGRESS_GAMES.includes(game as ProgressGame)) throw new GameError('Jeu inconnu');
  const w = won === true;
  return {
    game: game as ProgressGame,
    amount: XP_PLAY + (w ? XP_WIN : 0),
    coins: COINS_PLAY + (w ? COINS_WIN : 0),
    won: w,
  };
}

/** The shop item asked for, with its price; the database checks the coins. */
export function shopItem(kind: unknown, id: unknown, month = monthOf()): { key: string; price: number } {
  const item = SHOP_ITEMS.find((x) => x.kind === kind && x.id === id);
  if (!item || item.price === undefined) throw new GameError('Article introuvable');
  if (!forSale(item, month)) throw new GameError('Cet article de saison n’est plus en vente');
  return { key: ownedKey(item.kind as RewardKind, item.id), price: item.price };
}

/** A quest of today that is finished, to take its coins. */
export function finishedQuest(day: string, questId: unknown, statsDay: unknown, stats: unknown): Quest {
  const quest = questsFor(day).find((q) => q.id === questId);
  if (!quest) throw new GameError('Cette quête est terminée, de nouvelles t’attendent');
  const today = statsDay === day ? ((stats ?? {}) as DayStats) : {};
  if (questProgress(quest, today) < quest.target) throw new GameError('Quête pas encore finie');
  return quest;
}

/** Today's challenge, once it is done, to take its coins. */
export function finishedChallenge(day: string, statsDay: unknown, stats: unknown, games: unknown): Challenge {
  const challenge = challengeFor(day);
  const today = statsDay === day ? ((stats ?? {}) as DayStats) : {};
  if (challengeProgress(challenge, today, (games ?? {}) as GameCounters) < challenge.target) {
    throw new GameError('Défi pas encore réussi');
  }
  return challenge;
}

/** Draws what a chest holds; the item is a shop item the player does not own yet. */
export function chestContents(
  kind: unknown,
  owned: unknown,
  rnd: () => number,
  month = monthOf(),
): { coins: number; item: string | null } {
  const roll = rollChest(kind === 'grand' ? 'grand' : ('normal' as ChestKind), rnd);
  const mine = cleanOwned(owned);
  const missing = SHOP_ITEMS.filter((x) => forSale(x, month))
    .map((x) => ownedKey(x.kind as RewardKind, x.id))
    .filter((k) => !mine.includes(k));
  const item = roll.item && missing.length > 0 ? missing[Math.floor(rnd() * missing.length)] : null;
  return { coins: roll.coins, item };
}

interface ProgressRow {
  xp?: number;
  games?: unknown;
  best_streak?: number;
  owned?: unknown;
  quests_done?: number;
  feats?: unknown;
}

/** An achievement the player has reached, to take its coins. */
export function reachedAchievement(id: unknown, row: ProgressRow) {
  const a = findAchievement(id);
  if (!a) throw new GameError('Succès inconnu');
  const stats: AchievementStats = {
    games: (row.games ?? {}) as GameCounters,
    xp: row.xp ?? 0,
    bestStreak: row.best_streak ?? 0,
    owned: cleanOwned(row.owned).length,
    questsDone: row.quests_done ?? 0,
    feats: cleanOwned(row.feats),
  };
  if (achievementProgress(a.id, stats) < a.target) throw new GameError('Succès pas encore atteint');
  return a;
}

/** A rare moment a phone reports. */
export function cleanFeat(feat: unknown): Feat {
  if (!FEATS.includes(feat as Feat)) throw new GameError('Exploit inconnu');
  return feat as Feat;
}

/** A friend code typed by a player: 6 letters or digits, without the confusing ones. */
export function cleanFriendCode(raw: unknown): string {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) throw new GameError('Un code ami a 6 caractères');
  return code;
}

/** A person in my weekly ranking, as read from the profiles and progress tables. */
export interface LeaderboardPerson {
  user_id: string;
  name?: string | null;
  avatar?: string | null;
  avatar_color?: string | null;
  xp?: number | null;
  equipped?: unknown;
  owned?: unknown;
  /** Experience of the week counted by the database (see `count_week`), and of the week before. */
  week_start?: string | null;
  week_xp?: number | null;
  last_week_start?: string | null;
  last_week_xp?: number | null;
}

/**
 * Experience a player earned this week and last week. The database only moves the weeks on
 * when experience is earned, so a week that does not match is a week without experience.
 */
export function weekXpOf(p: LeaderboardPerson, monday: string): { week: number; lastWeek: number } {
  const before = previousWeek(monday);
  const xp = Math.max(0, p.week_xp ?? 0);
  return {
    week: p.week_start === monday ? xp : 0,
    lastWeek:
      p.week_start === before ? xp : p.last_week_start === before ? Math.max(0, p.last_week_xp ?? 0) : 0,
  };
}

/**
 * This week's ranking between me and my friends (online games, experience breaking ties),
 * last week's podium and my chest for it. `players` lets the phone rank again for one game
 * without asking the server.
 */
export function weeklyLeaderboard(
  meId: string,
  people: LeaderboardPerson[],
  results: OnlineResult[],
  monday: string,
  now: number,
) {
  const tallies = tallyResults(results, monday);
  const players: LeaderboardPlayer[] = people.map((p) => {
    const xp = weekXpOf(p, monday);
    return {
      user_id: p.user_id,
      name: p.name || 'Joueur',
      avatar: p.avatar ?? null,
      avatar_color: p.avatar_color ?? null,
      xp: p.xp ?? 0,
      equipped: p.equipped ?? {},
      owned: p.owned ?? [],
      me: p.user_id === meId,
      week: tallies.get(p.user_id)?.week ?? {},
      lastWeek: tallies.get(p.user_id)?.lastWeek ?? {},
      weekXp: xp.week,
      lastWeekXp: xp.lastWeek,
    };
  });
  const short = (l: LeaderboardLine) => ({
    user_id: l.player.user_id,
    place: l.place,
    played: l.played,
    won: l.won,
    points: l.points,
    xp: l.xp,
    best: l.best,
  });
  return {
    week: monday,
    lastWeek: previousWeek(monday),
    endsAt: weekEndsAt(now),
    games: leaderboardGames(),
    players,
    ranking: rankLeaderboard(players, 'week').map(short),
    podium: leaderboardPodium(players).map(short),
    /** My chest for last week's podium (taken or not: the progress row says). */
    chest: leaderboardChest(players),
  };
}
