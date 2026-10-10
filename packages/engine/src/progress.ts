// Experience, levels and the cosmetic rewards they unlock. Shared by the app and the servers.
import { AVATAR_EMOJIS, type Avatar } from './avatars.ts';

export const MAX_LEVEL = 50;

/** Every game that gives experience. */
export type ProgressGame =
  | 'poker'
  | 'blackjack'
  | 'president'
  | 'yams'
  | 'belote'
  | 'puissance4'
  | 'bataille'
  | 'echecs'
  | 'rami'
  | 'uno'
  | 'huit'
  | 'tarot'
  | 'perudo';
export const PROGRESS_GAMES: ProgressGame[] = [
  'poker',
  'blackjack',
  'president',
  'yams',
  'belote',
  'puissance4',
  'bataille',
  'echecs',
  'rami',
  'uno',
  'huit',
  'tarot',
  'perudo',
];

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

export type RewardKind = 'frame' | 'title' | 'avatar' | 'cardBack' | 'banner' | 'emote';

export interface Reward {
  /** Stable id, stored in the database. For avatars it is the emoji itself. */
  id: string;
  kind: RewardKind;
  level: number;
  name: string;
  /** Shop items cost coins instead of unlocking with a level. */
  price?: number;
  /** Seasonal shop items are only for sale during their month (1-12). */
  season?: number;
  /** Trophies are neither sold nor unlocked by level: only won (the Friday tournament). */
  trophy?: boolean;
}

export const REWARD_KIND_NAMES: Record<RewardKind, string> = {
  frame: 'Bordures',
  title: 'Titres',
  avatar: 'Avatars',
  cardBack: 'Dos de cartes',
  banner: 'Bannières',
  emote: 'Emotes',
};

const r = (kind: RewardKind, id: string, level: number, name: string): Reward => ({ id, kind, level, name });
const shop = (kind: RewardKind, id: string, price: number, name: string, season?: number): Reward => ({
  id,
  kind,
  level: 1,
  name,
  price,
  ...(season ? { season } : {}),
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
  // Only for the champions of the Friday tournament.
  { id: 'vendredi', kind: 'title', level: 1, name: 'Champion du vendredi', trophy: true },

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

  // Emotes to throw at the table.
  shop('emote', '🐔', 150, 'Poule mouillée'),
  shop('emote', '🤑', 150, 'Jackpot'),
  shop('emote', '🥶', 150, 'Glacé'),
  shop('emote', '🤡', 150, 'Clown'),
  shop('emote', '😈', 200, 'Diabolique'),
  shop('emote', '🫡', 200, 'Respect'),
  shop('emote', '🥱', 200, 'Ennui'),
  shop('emote', '🎉', 250, 'Fête'),
  shop('emote', '👑', 300, 'Le roi'),
  shop('emote', '💸', 300, 'Ruiné'),

  // The season of each month: three items for sale only that month.
  shop('frame', 'givre', 600, 'Givre', 1),
  shop('banner', 'blizzard', 500, 'Blizzard', 1),
  shop('title', 'yeti', 300, 'Yéti', 1),
  shop('frame', 'carnaval', 600, 'Carnaval', 2),
  shop('banner', 'carnaval', 500, 'Carnaval', 2),
  shop('title', 'masque', 300, 'Masqué', 2),
  shop('frame', 'printemps', 600, 'Printemps', 3),
  shop('banner', 'prairie', 500, 'Prairie', 3),
  shop('title', 'jardinier', 300, 'Main verte', 3),
  shop('frame', 'poisson', 600, 'Poisson d’avril', 4),
  shop('banner', 'recif', 500, 'Récif', 4),
  shop('title', 'farceur', 300, 'Farceur', 4),
  shop('frame', 'fleurs', 600, 'Couronne de fleurs', 5),
  shop('banner', 'jardin', 500, 'Jardin fleuri', 5),
  shop('title', 'fleurbleue', 300, 'Fleur bleue', 5),
  shop('frame', 'musique', 600, 'Vinyle', 6),
  shop('banner', 'concert', 500, 'Concert', 6),
  shop('title', 'rockstar', 300, 'Rock star', 6),
  shop('frame', 'plage', 600, 'Bouée', 7),
  shop('banner', 'plage', 500, 'Plage', 7),
  shop('title', 'vacancier', 300, 'Vacancier', 7),
  shop('frame', 'filante', 600, 'Étoile filante', 8),
  shop('banner', 'nuitdete', 500, 'Nuit d’été', 8),
  shop('title', 'reveur', 300, 'Rêveur', 8),
  shop('frame', 'ecolier', 600, 'Crayons', 9),
  shop('banner', 'tableau', 500, 'Tableau noir', 9),
  shop('title', 'premier', 300, 'Premier de la classe', 9),
  shop('frame', 'halloween', 600, 'Citrouille', 10),
  shop('banner', 'halloween', 500, 'Nuit d’Halloween', 10),
  shop('title', 'fantome', 300, 'Fantôme', 10),
  shop('frame', 'automne', 600, 'Feuilles d’automne', 11),
  shop('banner', 'automne', 500, 'Forêt d’automne', 11),
  shop('title', 'chataigne', 300, 'Châtaigne', 11),
  shop('frame', 'noel', 600, 'Guirlande', 12),
  shop('banner', 'noel', 500, 'Nuit de Noël', 12),
  shop('title', 'lutin', 300, 'Lutin', 12),
];

/** How a bought item is stored in a player's collection, since ids repeat across kinds. */
export function ownedKey(kind: RewardKind, id: string): string {
  return `${kind}:${id}`;
}

/** Items for sale (seasonal ones only during their month, see `forSale`). */
export const SHOP_ITEMS: Reward[] = REWARDS.filter((x) => x.price !== undefined);

/** Whether a shop item can be bought in a month (1-12). */
export function forSale(item: Reward, month: number): boolean {
  return item.price !== undefined && (item.season === undefined || item.season === month);
}

/** Reactions everyone has, and those bought in the shop. */
export const FREE_EMOTES = ['😂', '🔥', '😱', '👏', '😡', '🤝', '👍', '😭'];
export const ALL_EMOTES = [...FREE_EMOTES, ...REWARDS.filter((x) => x.kind === 'emote').map((x) => x.id)];
export function emotesFor(owned: readonly string[]): string[] {
  return [
    ...FREE_EMOTES,
    ...REWARDS.filter((x) => x.kind === 'emote' && owned.includes(ownedKey('emote', x.id))).map((x) => x.id),
  ];
}

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
  if (reward.price !== undefined || reward.trophy) return owned.includes(ownedKey(kind, reward.id));
  return reward.level <= level;
}

/** Rewards that unlock exactly at a level, to celebrate a level up. */
export function rewardsAtLevel(level: number): Reward[] {
  return REWARDS.filter((x) => x.level === level && x.price === undefined && !x.trophy);
}

/** The next reward still locked, to show what is coming. */
export function nextReward(level: number): Reward | undefined {
  return REWARDS.filter((x) => x.level > level && x.price === undefined && !x.trophy).sort(
    (a, b) => a.level - b.level,
  )[0];
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
