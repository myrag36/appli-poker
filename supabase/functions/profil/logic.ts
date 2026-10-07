// Rules of the profile server, without database access so they can be tested on their own.
import {
  DEFAULT_EQUIPPED,
  type Equipped,
  PROGRESS_GAMES,
  type ProgressGame,
  XP_PLAY,
  XP_WIN,
  cleanEquipped,
  isUnlocked,
  levelFromXp,
} from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';

const SLOTS: (keyof Equipped)[] = ['frame', 'title', 'cardBack', 'banner'];

/** Puts on a reward the player has unlocked, keeping the rest of what they wear. */
export function equip(xp: number, current: unknown, slot: unknown, id: unknown): Equipped {
  if (!SLOTS.includes(slot as keyof Equipped)) throw new GameError('Emplacement inconnu');
  const level = levelFromXp(xp);
  const kind = slot as keyof Equipped;
  if (!isUnlocked(kind, id, level)) throw new GameError('Pas encore débloqué');
  return { ...cleanEquipped(current ?? DEFAULT_EQUIPPED, level), [kind]: id as string };
}

/** Experience asked for a game finished on one phone. */
export function localGame(game: unknown, won: unknown): { game: ProgressGame; amount: number; won: boolean } {
  if (!PROGRESS_GAMES.includes(game as ProgressGame)) throw new GameError('Jeu inconnu');
  const w = won === true;
  return { game: game as ProgressGame, amount: XP_PLAY + (w ? XP_WIN : 0), won: w };
}
