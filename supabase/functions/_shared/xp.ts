// Gives experience from the game servers. A failure is logged but never undoes a move.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  COINS_PLAY,
  COINS_WIN,
  XP_DAILY,
  type ProgressGame,
  avatarEmojisFor,
  cleanOwned,
  levelFromXp,
} from './engine/index.ts';

export async function awardXp(
  db: SupabaseClient,
  userId: string,
  game: ProgressGame,
  amount: number,
  finished: { won: boolean } | null,
) {
  const { data, error } = await db.rpc('award_xp', {
    p_user: userId,
    p_game: game,
    p_amount: amount,
    p_played: finished !== null,
    p_won: finished?.won ?? false,
    p_daily: XP_DAILY,
    p_coins: finished ? COINS_PLAY + (finished.won ? COINS_WIN : 0) : 0,
  });
  if (error) console.error('expérience non enregistrée', error);
  else await levelChests(db, userId, data);
}

/** One chest for each level just reached. */
export async function levelChests(db: SupabaseClient, userId: string, result: { before?: number; after?: number }) {
  const gained = levelFromXp(result?.after ?? 0) - levelFromXp(result?.before ?? 0);
  for (let i = 0; i < gained; i++) {
    const { error } = await db.rpc('grant_chest', { p_user: userId, p_kind: 'normal', p_reason: 'niveau' });
    if (error) console.error('coffre non donné', error);
  }
}

/** Avatar emojis this player has unlocked with their level or bought. */
export async function unlockedEmojis(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await db.from('player_progress').select('xp, owned').eq('user_id', userId).maybeSingle();
  return avatarEmojisFor(levelFromXp(data?.xp ?? 0), cleanOwned(data?.owned));
}
