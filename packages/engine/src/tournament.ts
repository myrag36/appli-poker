/** How the big blind grows from one tournament level to the next, relative to the starting one. */
const LEVEL_FACTORS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

/** Big blind at a tournament level (0 = start), always even so the small blind is half of it. */
export function bigBlindAt(startBigBlind: number, level: number): number {
  const factor = LEVEL_FACTORS[Math.min(Math.max(0, level), LEVEL_FACTORS.length - 1)];
  return Math.max(2, Math.round((startBigBlind * factor) / 2) * 2);
}

/** Current tournament level and when the next one starts, both from epoch milliseconds. */
export function blindLevel(startedAt: number, now: number, levelMinutes: number) {
  const length = levelMinutes * 60_000;
  const level = Math.max(0, Math.floor((now - startedAt) / length));
  return { level, nextLevelAt: startedAt + (level + 1) * length };
}
