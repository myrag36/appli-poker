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
} from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';

const SLOTS: (keyof Equipped)[] = ['frame', 'title', 'cardBack', 'banner'];

/** Puts on a reward the player has unlocked or bought, keeping the rest of what they wear. */
export function equip(xp: number, current: unknown, slot: unknown, id: unknown, owned: unknown = []): Equipped {
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

/** Draws what a chest holds; the item is a shop item the player does not own yet. */
export function chestContents(
  kind: unknown,
  owned: unknown,
  rnd: () => number,
  month = monthOf(),
): { coins: number; item: string | null } {
  const roll = rollChest(kind === 'grand' ? 'grand' : ('normal' as ChestKind), rnd);
  const mine = cleanOwned(owned);
  const missing = SHOP_ITEMS.filter((x) => forSale(x, month)).map((x) => ownedKey(x.kind as RewardKind, x.id)).filter((k) => !mine.includes(k));
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

/**
 * Last week's podium among friends: the chest for my place, or null. Nobody wins alone,
 * and a week without experience wins nothing.
 */
export function podiumChest(me: string, board: { user_id: string; xp: number }[]): 'grand' | 'normal' | null {
  const played = board.filter((r) => r.xp > 0).sort((a, b) => b.xp - a.xp);
  if (played.length < 2) return null;
  const mine = played.find((r) => r.user_id === me);
  if (!mine) return null;
  const place = played.filter((r) => r.xp > mine.xp).length + 1;
  return place === 1 ? 'grand' : place <= 3 ? 'normal' : null;
}
