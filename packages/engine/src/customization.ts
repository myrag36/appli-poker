// Items earned by playing (achievements, daily challenges): when they are due, and how far
// a player is from them. The catalog itself is REWARDS, in progress.ts.
import { type AchievementStats, achievementProgress, findAchievement } from './achievements.ts';
import {
  REWARDS,
  type Reward,
  type RewardKind,
  type UnlockCondition,
  boughtCount,
  cleanOwned,
  ownedKey,
} from './progress.ts';
import type { GameCounters } from './progress.ts';
import { SEASONS } from './seasons.ts';

/** The kinds shown on the "Personnaliser" screen, in its order. */
export const CUSTOM_KINDS: RewardKind[] = ['cardBack', 'chip', 'felt', 'frame'];

/** Everything earned items are measured on: the achievement stats and the challenges taken. */
export interface UnlockStats extends AchievementStats {
  challengesDone: number;
}

/** How far a player is toward an unlock condition. */
export function conditionProgress(cond: UnlockCondition, stats: UnlockStats): { done: number; target: number } {
  if ('challenges' in cond) {
    return { done: Math.min(cond.challenges, stats.challengesDone), target: cond.challenges };
  }
  const a = findAchievement(cond.achievement);
  if (!a) return { done: 0, target: 1 };
  return { done: achievementProgress(a.id, stats), target: a.target };
}

export function conditionMet(cond: UnlockCondition, stats: UnlockStats): boolean {
  const { done, target } = conditionProgress(cond, stats);
  return done >= target;
}

/** Items earned by playing whose condition is met but that are not in the collection yet. */
export function pendingUnlocks(stats: UnlockStats, owned: readonly string[]): Reward[] {
  return REWARDS.filter(
    (r) => r.unlock && conditionMet(r.unlock, stats) && !owned.includes(ownedKey(r.kind, r.id)),
  );
}

/** A progress row as both the app and the profile server read it from the database. */
export interface UnlockRow {
  xp?: number | null;
  games?: unknown;
  best_streak?: number | null;
  owned?: unknown;
  quests_done?: number | null;
  feats?: unknown;
  challenges_done?: number | null;
}

/** The stats of a progress row. Only bought items count for the shopping achievements. */
export function unlockStats(row: UnlockRow): UnlockStats {
  return {
    games: (row.games ?? {}) as GameCounters,
    xp: row.xp ?? 0,
    bestStreak: row.best_streak ?? 0,
    owned: boughtCount(cleanOwned(row.owned)),
    questsDone: row.quests_done ?? 0,
    feats: cleanOwned(row.feats),
    challengesDone: row.challenges_done ?? 0,
  };
}

/** How an item is obtained, in French (a translation key and its values). */
export function unlockText(reward: Reward): { text: string; vars: Record<string, string | number> } {
  if (reward.unlock) {
    if ('challenges' in reward.unlock) {
      return reward.unlock.challenges === 1
        ? { text: 'Réussis un défi du jour', vars: {} }
        : { text: 'Réussis {n} défis du jour', vars: { n: reward.unlock.challenges } };
    }
    const a = findAchievement(reward.unlock.achievement);
    return { text: 'Succès « {name} »', vars: { name: a?.name ?? reward.unlock.achievement } };
  }
  if (reward.season !== undefined) {
    return { text: 'Saison « {name} », {n} pièces', vars: { name: SEASONS[reward.season - 1].name, n: reward.price ?? 0 } };
  }
  if (reward.price !== undefined) return { text: '{n} pièces', vars: { n: reward.price } };
  return { text: 'Niveau {n}', vars: { n: reward.level } };
}
