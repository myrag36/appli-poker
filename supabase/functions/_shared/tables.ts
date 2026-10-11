// The tables players invite others to: shared by the servers that send invitations.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { GameError } from '../poker/logic.ts';

/** My seat at the table with this code: my name there and the table's game. */
export async function myTable(admin: SupabaseClient, userId: string, game: string, code: string) {
  if (game === 'poker') {
    const { data: room } = await admin.from('rooms').select('id').eq('code', code).maybeSingle();
    if (!room) throw new GameError('Aucune table avec ce code');
    const { data: me } = await admin
      .from('room_players')
      .select('name')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!me) throw new GameError('Tu n’es pas à cette table');
    return { name: me.name as string };
  }
  const { data: room } = await admin
    .from('game_rooms')
    .select('id, game, status')
    .eq('code', code)
    .maybeSingle();
  if (!room || room.game !== game) throw new GameError('Aucune table avec ce code');
  if (room.status !== 'lobby') throw new GameError('La partie a déjà commencé');
  const { data: me } = await admin
    .from('game_players')
    .select('name')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!me) throw new GameError('Tu n’es pas à cette table');
  return { name: me.name as string };
}
