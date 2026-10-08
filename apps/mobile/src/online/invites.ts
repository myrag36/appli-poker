import { callProfile, ensureSignedIn, supabase } from './supabase';

/** An invitation a friend sent me to their table. */
export interface TableInvite {
  id: string;
  from_name: string;
  /** 'poker' or an online game id. */
  game: string;
  room_code: string;
  created_at: string;
}

/** Invitations older than this are hidden: the table has probably started without me. */
const FRESH_MS = 30 * 60_000;

/** Invites a friend to my table; `notified` tells whether a notification reached their phone. */
export async function inviteFriend(friendId: string, game: string, code: string) {
  return await callProfile<{ ok: true; notified: boolean }>({ type: 'invite', friendId, game, code });
}

/** The invitations of the last half hour, newest first. */
export async function loadInvites(): Promise<TableInvite[]> {
  await ensureSignedIn();
  const { data, error } = await supabase
    .from('table_invites')
    .select('id, from_name, game, room_code, created_at')
    .gte('created_at', new Date(Date.now() - FRESH_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []) as TableInvite[];
}

export async function dismissInvite(id: string) {
  await supabase.from('table_invites').delete().eq('id', id);
}
