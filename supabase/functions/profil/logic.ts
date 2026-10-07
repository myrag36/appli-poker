// Rules of the profile server, without database access so they can be tested on their own.
import {
  COINS_PLAY,
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
export function shopItem(kind: unknown, id: unknown): { key: string; price: number } {
  const item = SHOP_ITEMS.find((x) => x.kind === kind && x.id === id);
  if (!item || item.price === undefined) throw new GameError('Article introuvable');
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
