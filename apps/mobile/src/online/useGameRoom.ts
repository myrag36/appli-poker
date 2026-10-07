import { useCallback, useEffect, useRef, useState } from 'react';
import type { OnlineGameId, OnlineSeat } from '@appli-poker/engine';
import { callGames, supabase } from './supabase';

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
      setError('Connexion perdue, nouvel essai…');
      return;
    }
    if (!r.data) {
      if (loaded.current) setRemoved(true);
      else setError('Table introuvable');
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
      .subscribe((status) => {
        // Catch up on anything missed while the connection was down.
        if (status === 'SUBSCRIBED') refresh();
      });
    const poll = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

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

  return { room, players, myView, error, removed, refresh, now };
}
