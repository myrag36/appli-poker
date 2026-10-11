import { ALL_EMOTES } from '@appli-poker/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { HandView } from '@appli-poker/engine';
import { supabase } from './supabase';
import { t } from '../i18n';
import { pollWhileVisible } from './timers';

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
  /** The host paused the game: nobody can play until it resumes. */
  paused?: boolean;
  /** Texas Hold'em, or Omaha with four cards each. */
  variant?: 'holdem' | 'omaha';
  /**
   * `deadline` is when the player to act runs out of time, in epoch ms.
   * `tournament` is the blind level of this hand and when the next level starts.
   * `bots` lists the players the server plays for.
   */
  public_state:
    | (HandView & {
        deadline?: number | null;
        tournament?: { level: number; nextLevelAt: number } | null;
        bots?: string[];
      })
    | null;
  /** The table opened for a rematch once this game is over, and who asked for it. */
  rematch?: { roomId: string; code: string; byId: string; by: string } | null;
}

export interface RoomPlayer {
  user_id: string;
  name: string;
  seat: number;
  stack: number;
  /** Final rank once knocked out (1 = winner), or null while still in. */
  place: number | null;
  avatar: string | null;
  avatar_color: string | null;
  /** A computer player the host added; the server plays its moves. */
  is_bot?: boolean;
}

export type Reactions = Record<string, { emoji: string; key: number }>;

/** Last chat message each player sent while I was at the table, shown as a bubble by their seat. */
export type Bubbles = Record<string, { text: string; key: number }>;

export interface ChatMessage {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
}

/** Longest chat message, also enforced by the database. */
export const MAX_MESSAGE_LENGTH = 200;
/** How many past messages are loaded when opening a table. */
const HISTORY = 50;
/** How long a message stays in a bubble next to its author. */
const BUBBLE_MS = 6000;
/** How often the room is reloaded in case a realtime event was missed. */
const POLL_MS = 20_000;

/** The emojis players can send at the table. */
/** Reactions anyone may receive: the free ones and those sold in the shop. */
export const REACTIONS = ALL_EMOTES;

/** Live view of a room: refetched whenever the room, its players or my cards change. */
export function useRoom(roomId: string, userId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myCards, setMyCards] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The room disappears from what I can read once the host removes me from it.
  const [removed, setRemoved] = useState(false);
  const loaded = useRef(false);
  const [reactions, setReactions] = useState<Reactions>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<Bubbles>({});
  const [messagesLoaded, setMessagesLoaded] = useState(false);
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

  /** Adds messages in order, skipping any already shown (a message can arrive twice after a reconnect). */
  const addMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return current;
      return [...current, ...fresh].sort((a, b) => a.id - b.id).slice(-HISTORY);
    });
  }, []);

  /** A message just sent, as opposed to one loaded from the history. */
  const receiveMessage = useCallback(
    (message: ChatMessage) => {
      addMessages([message]);
      setBubbles((b) => ({ ...b, [message.user_id]: { text: message.body, key: message.id } }));
      // The bubble goes away after a while, unless a newer message replaced it.
      setTimeout(() => {
        setBubbles((b) => {
          if (b[message.user_id]?.key !== message.id) return b;
          const { [message.user_id]: _gone, ...rest } = b;
          return rest;
        });
      }, BUBBLE_MS);
    },
    [addMessages],
  );

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('room_messages')
      .select('id, user_id, body, created_at')
      .eq('room_id', roomId)
      .order('id', { ascending: false })
      .limit(HISTORY);
    if (!data) return;
    addMessages(data as ChatMessage[]);
    setMessagesLoaded(true);
  }, [roomId, addMessages]);

  /** Posts a chat message; the database checks that I am seated at this table. */
  const sendMessage = useCallback(
    async (text: string) => {
      const body = text.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!body) return;
      const { data, error: sendError } = await supabase
        .from('room_messages')
        .insert({ room_id: roomId, body })
        .select('id, user_id, body, created_at')
        .single();
      if (sendError) throw new Error(t('Message non envoyé, réessaie'));
      receiveMessage(data as ChatMessage);
    },
    [roomId, receiveMessage],
  );

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    const [r, p, h] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
      supabase
        .from('room_players')
        .select('user_id, name, seat, stack, place, avatar, avatar_color, is_bot')
        .eq('room_id', roomId)
        .order('seat'),
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
      setError(t('Connexion perdue, nouvel essai…'));
      return;
    }
    if (!r.data) {
      if (loaded.current) setRemoved(true);
      else setError(t('Table introuvable'));
      return;
    }
    loaded.current = true;
    const nextRoom = r.data as Room;
    setRoom(nextRoom);
    setPlayers(p.data as RoomPlayer[]);
    setMyCards(h.data && h.data.hand_number === nextRoom.hand_number ? (h.data.cards as string[]) : []);
    setError(null);
  }, [roomId, userId]);

  useEffect(() => {
    refresh();
    loadMessages();
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        refresh,
      )
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        ({ new: message }) => receiveMessage(message as ChatMessage),
      )
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const { from, emoji } = (payload ?? {}) as { from?: unknown; emoji?: unknown };
        if (typeof from === 'string' && typeof emoji === 'string' && REACTIONS.includes(emoji)) {
          showReaction(from, emoji);
        }
      })
      .subscribe((status) => {
        // Catch up on anything missed while the connection was down.
        if (status === 'SUBSCRIBED') {
          refresh();
          loadMessages();
        }
      });
    channelRef.current = channel;
    // Realtime can miss events (a sleeping phone, or being removed from the table, which
    // hides the room's changes from me), so check again from time to time.
    const stopPolling = pollWhileVisible(refresh, POLL_MS);
    return () => {
      stopPolling();
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh, showReaction, receiveMessage, loadMessages]);

  return {
    room,
    players,
    myCards,
    error,
    refresh,
    reactions,
    sendReaction,
    messages,
    messagesLoaded,
    sendMessage,
    bubbles,
    removed,
  };
}
