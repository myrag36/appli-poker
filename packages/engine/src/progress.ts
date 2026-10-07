// Experience, levels and the cosmetic rewards they unlock. Shared by the app and the servers.
import { AVATAR_EMOJIS, type Avatar } from './avatars.ts';

export const MAX_LEVEL = 50;

/** Every game that gives experience. */
export type ProgressGame = 'poker' | 'blackjack' | 'president' | 'yams' | 'belote' | 'rami';
export const PROGRESS_GAMES: ProgressGame[] = ['poker', 'blackjack', 'president', 'yams', 'belote', 'rami'];

/** Experience for one finished game: playing always pays, winning pays more. */
export const XP_PLAY = 20;
export const XP_WIN = 30;
/** Each finished round of an online game (a deal, a blackjack round…). */
export const XP_ROUND = 5;
/** Extra experience for the first game of the day. */
export const XP_DAILY = 50;
/** Online poker has no real end, so each hand pays a little. */
export const XP_POKER_HAND = 3;
export const XP_POKER_POT = 4;

/** Total experience needed to reach a level (level 1 needs 0). */
export function xpForLevel(level: number): number {
  const n = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  return 15 * n * n + 85 * n;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Where a player is within their level, for the progress bar. */
export function levelProgress(xp: number): { level: number; into: number; needed: number; ratio: number } {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, needed: 0, ratio: 1 };
  const start = xpForLevel(level);
  const needed = xpForLevel(level + 1) - start;
  const into = xp - start;
  return { level, into, needed, ratio: into / needed };
}

export type RewardKind = 'frame' | 'title' | 'avatar' | 'cardBack' | 'banner';

export interface Reward {
  /** Stable id, stored in the database. For avatars it is the emoji itself. */
  id: string;
  kind: RewardKind;
  level: number;
  name: string;
  /** Shop items cost coins instead of unlocking with a level. */
  price?: number;
}

export const REWARD_KIND_NAMES: Record<RewardKind, string> = {
  frame: 'Bordures',
  title: 'Titres',
  avatar: 'Avatars',
  cardBack: 'Dos de cartes',
  banner: 'Bannières',
};

const r = (kind: RewardKind, id: string, level: number, name: string): Reward => ({ id, kind, level, name });
const shop = (kind: RewardKind, id: string, price: number, name: string): Reward => ({
  id,
  kind,
  level: 1,
  name,
  price,
});

/** Everything that can be unlocked, in level order within each kind. Level 1 items are free. */
export const REWARDS: Reward[] = [
  r('frame', 'none', 1, 'Sans bordure'),
  r('frame', 'bronze', 2, 'Bronze'),
  r('frame', 'silver', 5, 'Argent'),
  r('frame', 'gold', 10, 'Or'),
  r('frame', 'emerald', 15, 'Émeraude'),
  r('frame', 'ruby', 20, 'Rubis'),
  r('frame', 'neon', 25, 'Néon'),
  r('frame', 'fire', 30, 'Flammes'),
  r('frame', 'ice', 35, 'Glace'),
  r('frame', 'rainbow', 40, 'Arc-en-ciel'),
  r('frame', 'crown', 45, 'Couronne'),
  r('frame', 'legend', 50, 'Légendaire'),

  r('title', 'debutant', 1, 'Débutant'),
  r('title', 'habitue', 3, 'Habitué'),
  r('title', 'dimanche', 4, 'Joueur du dimanche'),
  r('title', 'bluffeur', 6, 'Bluffeur'),
  r('title', 'lanceur', 8, 'Lanceur de dés'),
  r('title', 'requin', 12, 'Requin'),
  r('title', 'croupier', 14, 'Croupier'),
  r('title', 'president', 18, 'Président à vie'),
  r('title', 'capot', 22, 'Roi du capot'),
  r('title', 'champion', 26, 'Champion'),
  r('title', 'asdesas', 32, 'As des as'),
  r('title', 'maitre', 42, 'Grand maître'),
  r('title', 'legende', 50, 'Légende'),

  r('avatar', '🐉', 7, 'Dragon'),
  r('avatar', '🦈', 9, 'Requin'),
  r('avatar', '🦅', 11, 'Aigle'),
  r('avatar', '🧙', 13, 'Magicien'),
  r('avatar', '🥷', 16, 'Ninja'),
  r('avatar', '🎩', 19, 'Gentleman'),
  r('avatar', '🦉', 23, 'Hibou'),
  r('avatar', '🃏', 29, 'Joker'),
  r('avatar', '💎', 34, 'Diamant'),
  r('avatar', '🔥', 39, 'Feu'),
  r('avatar', '🌟', 44, 'Étoile'),
  r('avatar', '🦚', 48, 'Paon'),

  r('cardBack', 'classic', 1, 'Classique'),
  r('cardBack', 'royal', 6, 'Bleu royal'),
  r('cardBack', 'emerald', 17, 'Émeraude'),
  r('cardBack', 'noir', 24, 'Noir et or'),
  r('cardBack', 'neon', 33, 'Néon'),
  r('cardBack', 'galaxy', 41, 'Galaxie'),
  r('cardBack', 'dragon', 49, 'Dragon'),

  r('banner', 'felt', 1, 'Tapis vert'),
  r('banner', 'sunset', 4, 'Coucher de soleil'),
  r('banner', 'ocean', 10, 'Océan'),
  r('banner', 'casino', 21, 'Casino'),
  r('banner', 'aurora', 27, 'Aurore'),
  r('banner', 'lava', 31, 'Lave'),
  r('banner', 'cosmos', 38, 'Cosmos'),
  r('banner', 'gold', 46, 'Pluie d’or'),

  // The shop: bought with coins, at any level.
  shop('frame', 'sakura', 300, 'Sakura'),
  shop('frame', 'lagoon', 300, 'Lagon'),
  shop('frame', 'toxic', 500, 'Toxique'),
  shop('frame', 'shadow', 500, 'Ombre'),
  shop('frame', 'galaxy', 800, 'Galaxie'),
  shop('frame', 'diamond', 1200, 'Diamant'),

  shop('title', 'chanceux', 150, 'Chanceux'),
  shop('title', 'flambeur', 200, 'Flambeur'),
  shop('title', 'stratege', 250, 'Stratège'),
  shop('title', 'nuit', 300, 'Oiseau de nuit'),
  shop('title', 'repenti', 300, 'Tricheur repenti'),
  shop('title', 'millionnaire', 1000, 'Millionnaire'),

  shop('avatar', '🐧', 200, 'Pingouin'),
  shop('avatar', '🦩', 200, 'Flamant'),
  shop('avatar', '🎃', 250, 'Citrouille'),
  shop('avatar', '🤡', 250, 'Clown'),
  shop('avatar', '🧞', 350, 'Génie'),
  shop('avatar', '🧜', 350, 'Sirène'),
  shop('avatar', '🧛', 400, 'Vampire'),
  shop('avatar', '🦸', 600, 'Super-héros'),

  shop('cardBack', 'sakura', 300, 'Sakura'),
  shop('cardBack', 'retro', 300, 'Rétro'),
  shop('cardBack', 'carbon', 400, 'Carbone'),
  shop('cardBack', 'circuit', 500, 'Circuit'),
  shop('cardBack', 'goldbar', 900, 'Or massif'),

  shop('banner', 'forest', 300, 'Forêt'),
  shop('banner', 'desert', 300, 'Désert'),
  shop('banner', 'snow', 300, 'Neige'),
  shop('banner', 'city', 450, 'Ville la nuit'),
  shop('banner', 'vegas', 700, 'Las Vegas'),
  shop('banner', 'dragon', 1000, 'Repaire du dragon'),
];

/** How a bought item is stored in a player's collection, since ids repeat across kinds. */
export function ownedKey(kind: RewardKind, id: string): string {
  return `${kind}:${id}`;
}

/** Items for sale. */
export const SHOP_ITEMS: Reward[] = REWARDS.filter((x) => x.price !== undefined);

/** What a player has chosen to show. Each slot holds a reward id of that kind. */
export interface Equipped {
  frame: string;
  title: string;
  cardBack: string;
  banner: string;
}

export const DEFAULT_EQUIPPED: Equipped = {
  frame: 'none',
  title: 'debutant',
  cardBack: 'classic',
  banner: 'felt',
};

export function findReward(kind: RewardKind, id: unknown): Reward | undefined {
  return REWARDS.find((x) => x.kind === kind && x.id === id);
}

/** Whether a player may use an item: reached its level, or bought it. */
export function isUnlocked(
  kind: RewardKind,
  id: unknown,
  level: number,
  owned: readonly string[] = [],
): boolean {
  const reward = findReward(kind, id);
  if (!reward) return false;
  if (reward.price !== undefined) return owned.includes(ownedKey(kind, reward.id));
  return reward.level <= level;
}

/** Rewards that unlock exactly at a level, to celebrate a level up. */
export function rewardsAtLevel(level: number): Reward[] {
  return REWARDS.filter((x) => x.level === level && x.price === undefined);
}

/** The next reward still locked, to show what is coming. */
export function nextReward(level: number): Reward | undefined {
  return REWARDS.filter((x) => x.level > level && x.price === undefined).sort((a, b) => a.level - b.level)[0];
}

/** Keeps only equipped items that exist and are unlocked; anything else goes back to the default. */
export function cleanEquipped(raw: unknown, level: number, owned: readonly string[] = []): Equipped {
  const e = (raw ?? {}) as Partial<Equipped>;
  const pick = (kind: keyof Equipped) =>
    isUnlocked(kind, e[kind], level, owned) ? (e[kind] as string) : DEFAULT_EQUIPPED[kind];
  return { frame: pick('frame'), title: pick('title'), cardBack: pick('cardBack'), banner: pick('banner') };
}

/** Every avatar emoji a player may pick: the free ones plus those unlocked or bought. */
export function avatarEmojisFor(level: number, owned: readonly string[] = []): string[] {
  return [
    ...AVATAR_EMOJIS,
    ...REWARDS.filter((x) => x.kind === 'avatar' && isUnlocked('avatar', x.id, level, owned)).map(
      (x) => x.id,
    ),
  ];
}

/** Every avatar emoji anybody may have, to show other players as they are. */
export const ALL_AVATAR_EMOJIS: string[] = [
  ...AVATAR_EMOJIS,
  ...REWARDS.filter((x) => x.kind === 'avatar').map((x) => x.id),
];

/** Like cleanAvatar, but also accepts the emojis this player unlocked or bought. */
export function avatarAllowed(avatar: Avatar, level: number, owned: readonly string[] = []): boolean {
  return avatarEmojisFor(level, owned).includes(avatar.emoji);
}

/** Cleans a stored list of bought items. */
export function cleanOwned(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

/** Experience for a finished game, with the daily bonus if it is the first one today. */
export function gameXp(won: boolean, firstToday: boolean): number {
  return XP_PLAY + (won ? XP_WIN : 0) + (firstToday ? XP_DAILY : 0);
}

/** Per-game counters kept with the experience. */
export type GameCounters = Partial<Record<ProgressGame, { played: number; won: number }>>;
