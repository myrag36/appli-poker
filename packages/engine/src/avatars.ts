/** Emojis and background colors players can pick for their avatar. */
export const AVATAR_EMOJIS = [
  '🦊',
  '🐼',
  '🦁',
  '🐯',
  '🐸',
  '🐵',
  '🦄',
  '🐙',
  '🐺',
  '🐻',
  '🐨',
  '🐶',
  '🐱',
  '🦖',
  '👽',
  '🤖',
  '🤠',
  '😎',
  '👑',
  '💀',
];
export const AVATAR_COLORS = [
  '#e76f51',
  '#2a9d8f',
  '#e9c46a',
  '#8e7dbe',
  '#f4a261',
  '#4ea8de',
  '#d17a9e',
  '#90be6d',
];

export interface Avatar {
  emoji: string;
  color: string;
  /** Border unlocked with levels (see progress.ts), drawn around the avatar. */
  frame?: string;
  /** Player level, shown in a small chip on the avatar. */
  level?: number;
}

/**
 * Keeps a chosen avatar if it is one of the allowed ones, otherwise falls back to `fallback`.
 * `extra` lists the emojis the player has unlocked with levels.
 */
export function cleanAvatar(raw: unknown, fallback: Avatar, extra: string[] = []): Avatar {
  const a = raw as Partial<Avatar> | null;
  const ok = (e: unknown) => typeof e === 'string' && (AVATAR_EMOJIS.includes(e) || extra.includes(e));
  return {
    emoji: ok(a?.emoji) ? (a!.emoji as string) : fallback.emoji,
    color: typeof a?.color === 'string' && AVATAR_COLORS.includes(a.color) ? a.color : fallback.color,
  };
}

/** A different default avatar for each seat. */
export function defaultAvatar(seat: number): Avatar {
  return {
    emoji: AVATAR_EMOJIS[(seat * 7) % AVATAR_EMOJIS.length],
    color: AVATAR_COLORS[seat % AVATAR_COLORS.length],
  };
}
