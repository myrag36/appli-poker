import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ALL_EMOTES, type OnlineGameId, type OnlineSeat } from '@appli-poker/engine';
import { callGames, supabase } from './supabase';
import { t } from '../i18n';

/** What every player at an online table sees (written by the `jeux` server). */
export interface GamePublicState {
  game: OnlineGameId;
  seats: OnlineSeat[];
  /** Ids of the players who may move now. */
  actors: string[];
  /** When the current wait ends, in epoch ms: a turn, a robot's pause or the pause between rounds. */
  deadline: number | null;
  betweenRounds: boolean;
  over: boolean;
  view: unknown;
}

export interface GameRoom {
  id: string;
  code: string;
  game: OnlineGameId;
  host_id: string;
  options: Record<string, unknown>;
  status: 'lobby' | 'playing';
  version: number;
  public_state: GamePublicState | null;
  /** The table opened for a rematch once this game is over, and who asked for it. */
  rematch?: { roomId: string; code: string; byId: string; by: string } | null;
}

export interface GamePlayer {
  user_id: string;
  name: string;
  seat: number;
  avatar: string | null;
  avatar_color: string | null;
  is_bot: boolean;
}

/** How often the table is reloaded in case a realtime event was missed. */
const POLL_MS = 15_000;
/** How long a reaction floats above its sender's seat. */
const REACTION_MS = 3_000;
/** Shortest gap between two of my reactions, so nobody floods the table. */
const REACTION_GAP_MS = 800;

/** The last emoji each player sent; `key` changes with every reaction so it animates again. */
export type GameReactions = Record<string, { emoji: string; key: number }>;

/** Live view of an online table: refetched whenever the table, its players or my own view change. */
export function useGameRoom(roomId: string, userId: string) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  /** My own view of the game, with my hidden cards; null until the game starts. */
  const [myView, setMyView] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  // The table disappears from what I can read once the host removes me from it.
  const [removed, setRemoved] = useState(false);
  const [now, setNow] = useState(Date.now());
  const loaded = useRef(false);
  const latestRequest = useRef(0);
  const lastTick = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [reactions, setReactions] = useState<GameReactions>({});
  const lastReaction = useRef(0);

  const showReaction = useCallback((from: string, emoji: string) => {
    const key = Date.now() + Math.random();
    setReactions((r) => ({ ...r, [from]: { emoji, key } }));
    setTimeout(() => {
      setReactions((r) => {
        if (r[from]?.key !== key) return r;
        const { [from]: _gone, ...rest } = r;
        return rest;
      });
    }, REACTION_MS);
  }, []);

  /** Emoji reactions go straight to the other phones over Realtime, without the game server. */
  const sendReaction = useCallback(
    (emoji: string) => {
      const ts = Date.now();
      if (ts - lastReaction.current < REACTION_GAP_MS) return;
      lastReaction.current = ts;
      showReaction(userId, emoji);
      channelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { from: userId, emoji } });
    },
    [userId, showReaction],
  );

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    const [r, p, v] = await Promise.all([
      supabase.from('game_rooms').select('*').eq('id', roomId).maybeSingle(),
      supabase
        .from('game_players')
        .select('user_id, name, seat, avatar, avatar_color, is_bot')
        .eq('room_id', roomId)
        .order('seat'),
      supabase
        .from('game_private')
        .select('view, version')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    // A newer refresh started meanwhile: let it win so the screen never goes back in time.
    if (request !== latestRequest.current) return;
    if (r.error || p.error || v.error) {
      setError(t('Connexion perdue, nouvel essai…'));
      return;
    }
    if (!r.data) {
      if (loaded.current) setRemoved(true);
      else setError(t('Table introuvable'));
      return;
    }
    loaded.current = true;
    setRoom(r.data as GameRoom);
    setPlayers(p.data as GamePlayer[]);
    setMyView(v.data?.view ?? null);
    setError(null);
  }, [roomId, userId]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`game:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_private', filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const { from, emoji } = (payload ?? {}) as { from?: unknown; emoji?: unknown };
        if (typeof from === 'string' && typeof emoji === 'string' && ALL_EMOTES.includes(emoji)) {
          showReaction(from, emoji);
        }
      })
      .subscribe((status) => {
        // Catch up on anything missed while the connection was down.
        if (status === 'SUBSCRIBED') refresh();
      });
    channelRef.current = channel;
    const poll = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(poll);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh, showReaction]);

  const deadline = room?.public_state?.deadline ?? null;

  // A clock for the turn timers, running only while someone is waited for.
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  // Once the wait is over, any phone at the table asks the server to move on: a robot
  // plays, a slow player is played for, or the next round starts.
  useEffect(() => {
    if (!deadline || now < deadline || now - lastTick.current < 1500) return;
    lastTick.current = now;
    callGames({ type: 'tick', roomId })
      .then(refresh)
      .catch(() => {
        // Another phone was faster, or the deadline moved: the next refresh tells.
      });
  }, [deadline, now, roomId, refresh]);

  return { room, players, myView, error, removed, refresh, now, reactions, sendReaction };
}
