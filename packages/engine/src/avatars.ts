/** Emojis and background colors players can pick for their avatar. */
export const AVATAR_EMOJIS = [
  '🦊', '🐼', '🦁', '🐯', '🐸', '🐵', '🦄', '🐙', '🐺', '🐻',
  '🐨', '🐶', '🐱', '🦖', '👽', '🤖', '🤠', '😎', '👑', '💀',
];
export const AVATAR_COLORS = ['#e76f51', '#2a9d8f', '#e9c46a', '#8e7dbe', '#f4a261', '#4ea8de', '#d17a9e', '#90be6d'];

export interface Avatar {
  emoji: string;
  color: string;
}

/** Keeps a chosen avatar if it is one of the allowed ones, otherwise falls back to `fallback`. */
export function cleanAvatar(raw: unknown, fallback: Avatar): Avatar {
  const a = raw as Partial<Avatar> | null;
  return {
    emoji: typeof a?.emoji === 'string' && AVATAR_EMOJIS.includes(a.emoji) ? a.emoji : fallback.emoji,
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
