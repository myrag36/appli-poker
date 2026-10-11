// Partie rapide and public tables, on the phone side: the search queue, the "Tables ouvertes"
// list, my ratings, and the players I blocked. Every write goes through the `jeux` server.
import { useEffect, useState } from 'react';
import type { Avatar, QuickGameId } from '@appli-poker/engine';
import { callGames, ensureSignedIn, supabase } from './supabase';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

/** How often the waiting screen tells the server it is still there (the server expects 4 s). */
export const QUEUE_PING_MS = 4_000;
/** After this wait, "Compléter avec des robots" is offered (the server checks it too). */
export const QUEUE_FILL_AFTER_MS = 30_000;

/** My search, as the server sees it. */
export interface QueueState {
  /** The server's clock, to count the time waited without trusting the phone's clock. */
  now: number;
  status: 'waiting' | 'matched' | 'none';
  game?: QuickGameId;
  size?: number;
  variant?: string;
  /** Other players found so far, who would sit with me now. */
  found: number;
  /** How long I have been searching (ms). */
  waited: number;
  canFill: boolean;
  /** My rating in this game when the search started. */
  rating?: number;
  roomId?: string;
  code?: string;
}

export function joinQueue(req: { game: QuickGameId; size: number; variant: string; name: string; avatar: Avatar }) {
  return callGames<QueueState>({ type: 'queueJoin', ...req });
}

export const pingQueue = () => callGames<QueueState>({ type: 'queuePing' });
export const fillQueue = () => callGames<QueueState>({ type: 'queueFill' });
export const leaveQueue = () => callGames<{ ok: true }>({ type: 'queueLeave' });

/**
 * Leaves the queue while the page closes: a normal request would be cancelled with the page, so
 * this one is sent with `keepalive`. The server forgets a silent search after a minute anyway.
 */
export async function leaveQueueOnClose() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || typeof fetch === 'undefined') return;
    fetch(`${SUPABASE_URL}/functions/v1/jeux`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ type: 'queueLeave' }),
    }).catch(() => {});
  } catch {
    // The server forgets the search on its own.
  }
}

/** A public table waiting for players, as strangers see it: pseudo, avatar and level only. */
export interface OpenTable {
  code: string;
  game: QuickGameId;
  players: number;
  max: number;
  host: { name: string; avatar: string | null; avatar_color: string | null; level: number };
  created_at: string;
}

export async function loadOpenTables(game?: QuickGameId): Promise<OpenTable[]> {
  const { tables } = await callGames<{ tables: OpenTable[] }>({ type: 'openTables', game });
  return tables;
}

/** "Tables ouvertes", refreshed every 15 s while shown. */
export function useOpenTables(game?: QuickGameId) {
  const [tables, setTables] = useState<OpenTable[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      loadOpenTables(game).then(
        (list) => {
          if (!alive) return;
          setTables(list);
          setFailed(false);
        },
        () => alive && setFailed(true),
      );
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [game]);
  return { tables, failed };
}

/** My rating in one game: only tables open to strangers change it. */
export interface GameRating {
  game: string;
  rating: number;
  games: number;
  wins: number;
}

export async function loadMyRatings(): Promise<GameRating[]> {
  const userId = await ensureSignedIn();
  const { data, error } = await supabase
    .from('game_ratings')
    .select('game, rating, games, wins')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as GameRating[]).sort((a, b) => b.games - a.games || b.rating - a.rating);
}

/** My ratings, by game (empty until loaded or when offline). */
export function useMyRatings(): Record<string, GameRating> {
  const [ratings, setRatings] = useState<Record<string, GameRating>>({});
  useEffect(() => {
    loadMyRatings().then(
      (list) => setRatings(Object.fromEntries(list.map((r) => [r.game, r]))),
      () => {},
    );
  }, []);
  return ratings;
}

/** How a finished table moved my rating ("+12"), once the server saved it. */
export interface RatingChange {
  delta: number;
  rating_after: number | null;
}

export async function loadRatingChange(roomId: string): Promise<RatingChange | null> {
  const userId = await ensureSignedIn();
  const { data, error } = await supabase
    .from('rating_changes')
    .select('delta, rating_after')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as RatingChange | null) ?? null;
}

/**
 * My rating change at a table that just ended (rated tables only): asked a few times, since the
 * server saves it right after the last move.
 */
export function useRatingChange(roomId: string, active: boolean): RatingChange | null {
  const [change, setChange] = useState<RatingChange | null>(null);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = () => {
      tries++;
      loadRatingChange(roomId).then(
        (c) => {
          if (!alive) return;
          if (c) setChange(c);
          else if (tries < 5) timer = setTimeout(ask, 1500);
        },
        () => alive && tries < 5 && (timer = setTimeout(ask, 2000)),
      );
    };
    ask();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [roomId, active]);
  return change;
}

/** A player I blocked: never seated with me again, their public tables hidden. */
export interface BlockedPlayer {
  blocked_id: string;
  name: string | null;
  avatar: string | null;
  avatar_color: string | null;
  created_at: string;
}

export async function loadBlocked(): Promise<BlockedPlayer[]> {
  const userId = await ensureSignedIn();
  const { data, error } = await supabase
    .from('player_blocks')
    .select('blocked_id, name, avatar, avatar_color, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlockedPlayer[];
}

export function blockPlayer(p: { userId: string; name: string; avatar: string | null; avatarColor: string | null }) {
  return callGames<{ ok: true }>({ type: 'block', ...p });
}

export function unblockPlayer(userId: string) {
  return callGames<{ ok: true }>({ type: 'unblock', userId });
}

/** "1:05": minutes and seconds waited. */
export function waitedLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
