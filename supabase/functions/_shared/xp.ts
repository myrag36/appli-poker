// Gives experience from the game servers. A failure is logged but never undoes a move.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { XP_DAILY, type ProgressGame, avatarEmojisFor, levelFromXp } from './engine/index.ts';

export async function awardXp(
  db: SupabaseClient,
  userId: string,
  game: ProgressGame,
  amount: number,
  finished: { won: boolean } | null,
) {
  const { error } = await db.rpc('award_xp', {
    p_user: userId,
    p_game: game,
    p_amount: amount,
    p_played: finished !== null,
    p_won: finished?.won ?? false,
    p_daily: XP_DAILY,
  });
  if (error) console.error('expérience non enregistrée', error);
}

/** Avatar emojis this player has unlocked with their level. */
export async function unlockedEmojis(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await db.from('player_progress').select('xp').eq('user_id', userId).maybeSingle();
  return avatarEmojisFor(levelFromXp(data?.xp ?? 0));
}
