import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { HandView } from '@appli-poker/engine';
import { supabase } from './supabase';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  big_blind: number;
  starting_stack: number;
  status: 'lobby' | 'playing';
  hand_number: number;
  version: number;
  /** Tournament level length in minutes, or null when the blinds never change. */
  level_minutes: number | null;
  /**
   * `deadline` is when the player to act runs out of time, in epoch ms.
   * `tournament` is the blind level of this hand and when the next level starts.
   */
  public_state:
    | (HandView & { deadline?: number | null; tournament?: { level: number; nextLevelAt: number } | null })
    | null;
}

export interface RoomPlayer {
  user_id: string;
  name: string;
  seat: number;
  stack: number;
  /** Final rank once knocked out (1 = winner), or null while still in. */
  place: number | null;
}

export type Reactions = Record<string, { emoji: string; key: number }>;

/** The emojis players can send at the table. */
export const REACTIONS = ['👍', '😂', '🔥', '😱', '😭', '👏'];

/** Live view of a room: refetched whenever the room, its players or my cards change. */
export function useRoom(roomId: string, userId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myCards, setMyCards] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Reactions>({});
  const latestRequest = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const showReaction = useCallback((from: string, emoji: string) => {
    setReactions((r) => ({ ...r, [from]: { emoji, key: Date.now() } }));
  }, []);

  /** Emoji reactions go straight to the other phones, without the game server. */
  const sendReaction = useCallback(
    (emoji: string) => {
      showReaction(userId, emoji);
      channelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { from: userId, emoji } });
    },
    [userId, showReaction],
  );

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    const [r, p, h] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
      supabase.from('room_players').select('user_id, name, seat, stack, place').eq('room_id', roomId).order('seat'),
      supabase
        .from('private_hands')
        .select('cards, hand_number')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    // A newer refresh started meanwhile: let it win so the screen never goes back in time.
    if (request !== latestRequest.current) return;
    if (r.error || p.error || h.error) {
      setError('Connexion perdue, nouvel essai…');
      return;
    }
    if (!r.data) {
      setError('Table introuvable');
      return;
    }
    const nextRoom = r.data as Room;
    setRoom(nextRoom);
    setPlayers(p.data as RoomPlayer[]);
    setMyCards(h.data && h.data.hand_number === nextRoom.hand_number ? (h.data.cards as string[]) : []);
    setError(null);
  }, [roomId, userId]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'private_hands', filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const { from, emoji } = (payload ?? {}) as { from?: unknown; emoji?: unknown };
        if (typeof from === 'string' && typeof emoji === 'string' && REACTIONS.includes(emoji)) {
          showReaction(from, emoji);
        }
      })
      .subscribe((status) => {
        // Catch up on anything missed while the connection was down.
        if (status === 'SUBSCRIBED') refresh();
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh, showReaction]);

  return { room, players, myCards, error, refresh, reactions, sendReaction };
}
