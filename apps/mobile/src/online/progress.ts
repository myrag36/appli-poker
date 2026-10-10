import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  type Chest,
  DEFAULT_EQUIPPED,
  type Feat,
  type DayStats,
  type Equipped,
  type GameCounters,
  type LeaderboardPlayer,
  type ProgressGame,
  type Reward,
  type RewardKind,
  cleanEquipped,
  cleanOwned,
  levelFromXp,
  liveChallengeStreak,
  parisDay,
  rewardsAtLevel,
} from '@appli-poker/engine';
import { setCardBack } from '../components/cardBacks';
import { t } from '../i18n';
import { callProfile, ensureSignedIn, loadAvatar, loadName, supabase } from './supabase';

export interface MyProgress {
  xp: number;
  level: number;
  equipped: Equipped;
  games: GameCounters;
  coins: number;
  /** Bought items, as "kind:id". */
  owned: string[];
  /** What I did today, for the quests, and the quests already paid today. */
  today: DayStats;
  claimed: string[];
  /** Days in a row with a game (still counted until a day is missed), and the record. */
  streak: number;
  bestStreak: number;
  chests: Chest[];
  /** Achievements already paid, rare moments seen, quests finished in all. */
  achievements: string[];
  feats: string[];
  questsDone: number;
  /** Monday of the week whose podium reward was taken. */
  podiumClaimed: string | null;
  /** Today's challenge already taken, and challenges taken days in a row. */
  challengeClaimed: boolean;
  challengeStreak: number;
}

/** Something to celebrate: experience just earned, maybe with a new level and its rewards. */
export interface ProgressEvent {
  key: number;
  gained: number;
  coins: number;
  level: number;
  levelUp: boolean;
  rewards: Reward[];
}

let mine: MyProgress | null = null;
let event: ProgressEvent | null = null;
let userId: string | null = null;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

interface Row {
  xp: number;
  equipped: unknown;
  games: unknown;
  coins?: number;
  owned?: unknown;
  stats_day?: string | null;
  day_stats?: unknown;
  quests_claimed?: unknown;
  last_day?: string | null;
  streak?: number;
  best_streak?: number;
  chests?: unknown;
  achievements?: unknown;
  feats?: unknown;
  quests_done?: number;
  podium_claimed?: string | null;
  challenge_day?: string | null;
  challenge_streak?: number;
}
const COLUMNS =
  'xp, equipped, games, coins, owned, stats_day, day_stats, quests_claimed, last_day, streak, best_streak, chests, achievements, feats, quests_done, podium_claimed, challenge_day, challenge_streak';

/** The streak still counts if the last game was today or yesterday. */
function liveStreak(lastDay: string | null | undefined, streak: number) {
  if (!lastDay) return 0;
  const today = parisDay();
  const yesterday = parisDay(new Date(Date.now() - 86_400_000));
  return lastDay === today || lastDay === yesterday ? streak : 0;
}

function apply(row: Row | null) {
  const xp = row?.xp ?? 0;
  const level = levelFromXp(xp);
  const owned = cleanOwned(row?.owned);
  const isToday = row?.stats_day === parisDay();
  const next: MyProgress = {
    xp,
    level,
    equipped: cleanEquipped(row?.equipped ?? DEFAULT_EQUIPPED, level, owned),
    games: (row?.games ?? {}) as GameCounters,
    coins: row?.coins ?? 0,
    owned,
    today: isToday ? ((row?.day_stats ?? {}) as DayStats) : {},
    claimed: isToday ? cleanOwned(row?.quests_claimed) : [],
    streak: liveStreak(row?.last_day, row?.streak ?? 0),
    bestStreak: row?.best_streak ?? 0,
    chests: Array.isArray(row?.chests) ? (row.chests as Chest[]) : [],
    achievements: cleanOwned(row?.achievements),
    feats: cleanOwned(row?.feats),
    questsDone: row?.quests_done ?? 0,
    podiumClaimed: row?.podium_claimed ?? null,
    challengeClaimed: row?.challenge_day === parisDay(),
    challengeStreak: liveChallengeStreak(row?.challenge_day, row?.challenge_streak ?? 0, parisDay()),
  };
  // Experience earned since the last look: celebrate it (not on the first load). Coins
  // from a quest are shown where they are taken, so only those won while playing count.
  if (mine && xp > mine.xp) {
    const levelUp = level > mine.level;
    const rewards: Reward[] = [];
    for (let l = mine.level + 1; l <= level; l++) rewards.push(...rewardsAtLevel(l));
    const coins = Math.max(0, next.coins - mine.coins);
    event = { key: Date.now(), gained: xp - mine.xp, coins, level, levelUp, rewards };
  }
  mine = next;
  setCardBack(next.equipped.cardBack);
  emit();
}

/** Reloads my experience from the server. */
export async function refreshProgress() {
  try {
    userId ??= await ensureSignedIn();
    const { data, error } = await supabase
      .from('player_progress')
      .select(COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (!error) apply(data);
  } catch {
    // Offline: the profile simply stays as it was.
  }
}

let myCode: string | null = null;

/** Saves the name and avatar friends see, and gets my friend code. Never fails loudly. */
export async function syncMe(): Promise<string | null> {
  try {
    const [name, avatar] = await Promise.all([loadName(), loadAvatar()]);
    const r = await callProfile<{ code: string }>({
      type: 'me',
      ...(name ? { name, avatar: avatar ?? undefined } : {}),
    });
    myCode = r.code;
  } catch {
    // Offline: friends will see the old name for now.
  }
  return myCode;
}

/** Starts following my experience: loads it and listens for changes made by the game servers. */
function start() {
  if (started) return;
  started = true;
  syncMe();
  refreshProgress().then(() => {
    if (!userId) return;
    supabase
      .channel(`progress:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_progress', filter: `user_id=eq.${userId}` },
        ({ new: row }) => apply(row as Row),
      )
      .subscribe();
  });
}

/** My level, experience and what I wear; null until loaded (or offline). */
export function useMyProgress(): MyProgress | null {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => mine);
}

/** The latest experience earned, for the celebration toast. */
export function useProgressEvent(): ProgressEvent | null {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => event);
}

/** Puts on an unlocked reward. */
export async function equipReward(slot: keyof Equipped, id: string) {
  if (mine) {
    mine = { ...mine, equipped: { ...mine.equipped, [slot]: id } };
    setCardBack(mine.equipped.cardBack);
    emit();
  }
  try {
    await callProfile({ type: 'equip', slot, id });
  } finally {
    await refreshProgress();
  }
}

/** A game finished on this phone: asks the server for its experience. Never fails loudly. */
export async function reportLocalGame(game: ProgressGame, won: boolean) {
  try {
    await callProfile({ type: 'local', game, won });
    await refreshProgress();
  } catch {
    // No connection: this game simply gives no experience.
  }
}

/** Buys a shop item with my coins. Throws the server's message when it can't. */
export async function buyItem(kind: RewardKind, id: string) {
  try {
    await callProfile({ type: 'buy', kind, id });
  } finally {
    await refreshProgress();
  }
}

/** Takes the coins of a finished quest. */
export async function claimQuest(quest: string) {
  try {
    await callProfile({ type: 'claim', quest });
  } finally {
    await refreshProgress();
  }
}

/** Takes the coins of today's challenge; says the streak bonus. */
export async function claimChallenge(): Promise<{ coins: number; bonus: number; streak: number }> {
  try {
    return await callProfile({ type: 'challenge' });
  } finally {
    await refreshProgress();
  }
}

/** Opens a chest; says what was inside. */
export async function openChest(id: string): Promise<{ coins: number; item: string | null; kind: string }> {
  try {
    return await callProfile({ type: 'open', chest: id });
  } finally {
    await refreshProgress();
  }
}

/** Takes the coins of a reached achievement. */
export async function claimAchievement(id: string) {
  try {
    await callProfile({ type: 'achieve', id });
  } finally {
    await refreshProgress();
  }
}

const reported = new Set<string>();

/** A rare moment just happened in a game: earns its badge (once). Never fails loudly. */
export function reportFeat(feat: Feat) {
  if (reported.has(feat) || mine?.feats.includes(feat)) return;
  reported.add(feat);
  callProfile({ type: 'feat', feat })
    .then(refreshProgress)
    .catch(() => reported.delete(feat));
}

/** Reports a rare moment when a condition becomes true during a game. */
export function useFeat(feat: Feat, happened: boolean) {
  useEffect(() => {
    if (happened) reportFeat(feat);
  }, [happened]);
}

export interface OtherProgress {
  level: number;
  frame: string;
  title: string;
}

/** Level, border and title of the people at a table, by user id. */
export function useProgressOf(ids: string[]): Record<string, OtherProgress> {
  const [map, setMap] = useState<Record<string, OtherProgress>>({});
  const key = [...ids].sort().join(',');
  useEffect(() => {
    if (!key) return;
    let live = true;
    supabase
      .from('player_progress')
      .select('user_id, xp, equipped, owned')
      .in('user_id', key.split(','))
      .then(({ data }) => {
        if (!live || !data) return;
        const next: Record<string, OtherProgress> = {};
        for (const row of data as { user_id: string; xp: number; equipped: unknown; owned: unknown }[]) {
          const level = levelFromXp(row.xp);
          const e = cleanEquipped(row.equipped, level, cleanOwned(row.owned));
          next[row.user_id] = { level, frame: e.frame, title: e.title };
        }
        setMap(next);
      });
    return () => {
      live = false;
    };
  }, [key]);
  return map;
}

export interface FriendRow {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  xp: number;
  equipped: unknown;
  owned: unknown;
  week_xp: number;
  week_wins: number;
  streak: number;
  last_week_xp: number;
  me: boolean;
}

/** Me and my friends (with the database's weekly experience, for older screens). */
export async function loadFriends(): Promise<FriendRow[]> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc('friends_board');
  if (error) throw new Error(t('Pas de connexion au serveur'));
  return (data ?? []) as FriendRow[];
}

/** This week's ranking of online games between me and my friends, from the profile server. */
export interface Leaderboard {
  /** Mondays of this week and last week ("YYYY-MM-DD", Paris). */
  week: string;
  lastWeek: string;
  /** When this week's ranking ends, in epoch milliseconds. */
  endsAt: number;
  players: LeaderboardPlayer[];
  /** My chest for last week's podium, taken or not (`MyProgress.podiumClaimed` says). */
  chest?: 'grand' | 'normal' | null;
}

export async function loadLeaderboard(): Promise<Leaderboard> {
  return await callProfile<Leaderboard>({ type: 'classement' });
}

export async function addFriend(code: string) {
  await callProfile({ type: 'addFriend', code });
}

export async function removeFriend(userId: string) {
  await callProfile({ type: 'removeFriend', userId });
}

/** Takes last week's podium chest. */
export async function claimPodium() {
  try {
    await callProfile({ type: 'podium' });
  } finally {
    await refreshProgress();
  }
}
