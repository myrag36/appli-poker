// Database side of the tables open to strangers, shared by the `jeux` and `poker` servers:
// blocks, and the Elo ratings a finished table changes. A failure is logged but never undoes a move.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { type BlockRow, type Placement, type RatingRow, isRated, ratingChanges } from '../jeux/rapide.ts';
import { rankTable } from './classees.ts';

/** Every block between these players and anyone (both ways). */
export async function loadBlocks(db: SupabaseClient, ids: string[]): Promise<BlockRow[]> {
  const people = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (people.length === 0) return [];
  const list = people.join(',');
  const { data, error } = await db
    .from('player_blocks')
    .select('user_id, blocked_id')
    .or(`user_id.in.(${list}),blocked_id.in.(${list})`);
  if (error) throw error;
  return (data ?? []) as BlockRow[];
}

/** Ratings of these players in one game (missing: never rated, 1000). */
export async function loadRatings(db: SupabaseClient, game: string, ids: string[]): Promise<RatingRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from('game_ratings')
    .select('user_id, rating, games')
    .eq('game', game)
    .in('user_id', ids);
  if (error) throw error;
  return (data ?? []) as RatingRow[];
}

/**
 * Once a table open to strangers ends: each person's rating in this game moves (robots never
 * count; a table with fewer than two people changes nothing). Saved once per table and person.
 * A ranked table changes the ranks instead, never the casual rating.
 */
export async function rateTable(
  db: SupabaseClient,
  room: { id: string; visibility?: string | null; ranked?: boolean | null },
  game: string,
  placements: Placement[],
) {
  if (room.ranked) {
    await rankTable(db, room, game, placements, game === 'poker' ? 'room_players' : 'game_players');
    return;
  }
  if (!isRated(room.visibility) || placements.length < 2) return;
  try {
    const ratings = await loadRatings(
      db,
      game,
      placements.map((p) => p.userId),
    );
    const changes = ratingChanges(placements, ratings);
    const { error } = await db.rpc('apply_ratings', { p_room: room.id, p_game: game, p_changes: changes });
    if (error) throw error;
  } catch (e) {
    console.error('cotes non mises à jour', e);
  }
}
