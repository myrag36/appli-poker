import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Action, Avatar, OnlineGameId, Variant, WeeklyBracket } from '@appli-poker/engine';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { t } from '../i18n';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Signs in anonymously the first time; the same account is kept on this phone afterwards. */
export async function ensureSignedIn(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signedIn.user) {
    throw new Error(t('Connexion impossible. Les connexions anonymes sont-elles activées dans Supabase ?'));
  }
  return signedIn.user.id;
}

type Request =
  | {
      type: 'create';
      name: string;
      bigBlind: number;
      stack: number;
      levelMinutes: number | null;
      avatar: Avatar;
      variant: Variant;
    }
  | { type: 'join'; name: string; code: string; avatar: Avatar }
  | { type: 'deal'; roomId: string }
  | { type: 'act'; roomId: string; action: Action }
  | { type: 'timeout'; roomId: string }
  | { type: 'pause'; roomId: string; paused: boolean }
  | { type: 'remove'; roomId: string; userId: string }
  | { type: 'addBot'; roomId: string }
  | { type: 'watch'; name: string; code: string }
  | { type: 'rematch'; roomId: string };

/** Calls the poker server and turns its error replies into readable messages. */
export function callServer<T>(body: Request): Promise<T> {
  return invoke<T>('poker', body);
}

type GamesRequest =
  | {
      type: 'create';
      game: OnlineGameId;
      name: string;
      avatar: Avatar;
      options: Record<string, unknown>;
      tournamentId?: string;
    }
  | { type: 'tournamentCreate'; title: string; games: OnlineGameId[]; name: string; avatar: Avatar }
  | { type: 'tournamentJoin'; code: string; name: string; avatar: Avatar }
  | { type: 'join'; game: OnlineGameId; name: string; code: string; avatar: Avatar }
  | { type: 'addBot' | 'start' | 'tick' | 'rematch'; roomId: string }
  | { type: 'remove'; roomId: string; userId: string }
  | { type: 'move'; roomId: string; move: unknown }
  | { type: 'weekly' | 'weeklyUnregister' }
  | { type: 'weeklyRegister'; name: string; avatar: Avatar };

/** Calls the server of the other games (Blackjack, Président, Yams, Belote). */
export function callGames<T>(body: GamesRequest): Promise<T> {
  return invoke<T>('jeux', body);
}

type ProfileRequest =
  | { type: 'equip'; slot: string; id: string }
  | { type: 'local'; game: string; won: boolean }
  | { type: 'buy'; kind: string; id: string }
  | { type: 'claim'; quest: string }
  | { type: 'open'; chest: string }
  | { type: 'achieve'; id: string }
  | { type: 'feat'; feat: string }
  | { type: 'unlock' }
  | { type: 'me'; name?: string; avatar?: Avatar }
  | { type: 'addFriend'; code: string }
  | { type: 'removeFriend'; userId: string }
  | { type: 'podium' }
  | { type: 'classement' }
  | { type: 'challenge' }
  | { type: 'pushKey' }
  | { type: 'pushSubscribe'; subscription: unknown; lang: string }
  | { type: 'pushUnsubscribe'; endpoint: string }
  | { type: 'invite'; friendId: string; game: string; code: string }
  | { type: 'message'; friendId: string; body: string };

/** Calls the profile server (games on one phone, rewards worn, shop and quests). */
export function callProfile<T>(body: ProfileRequest): Promise<T> {
  return invoke<T>('profil', body);
}

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  await ensureSignedIn();
  const { data, error } = await supabase.functions.invoke(fn, { body: body as Record<string, unknown> });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      // The servers answer in French: shown in the app's language when a translation exists.
      throw new Error(t(payload?.error ?? 'Erreur du serveur'));
    }
    throw new Error(t('Pas de connexion au serveur'));
  }
  return data as T;
}

const LAST_ROOM_KEY = 'appli-poker:last-room';

export interface SavedRoom {
  roomId: string;
  name: string;
}

export async function saveLastRoom(room: SavedRoom | null) {
  try {
    if (room) await AsyncStorage.setItem(LAST_ROOM_KEY, JSON.stringify(room));
    else await AsyncStorage.removeItem(LAST_ROOM_KEY);
  } catch {
    // Remembering the room is a convenience only.
  }
}

export async function loadLastRoom(): Promise<SavedRoom | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ROOM_KEY);
    return raw ? (JSON.parse(raw) as SavedRoom) : null;
  } catch {
    return null;
  }
}

const lastGameKey = (game: OnlineGameId) => `appli-poker:last-${game}-room`;

/** The online table of a game I was last at, to get back to it. */
export async function saveLastGameRoom(game: OnlineGameId, room: SavedRoom | null) {
  try {
    if (room) await AsyncStorage.setItem(lastGameKey(game), JSON.stringify(room));
    else await AsyncStorage.removeItem(lastGameKey(game));
  } catch {
    // Remembering the room is a convenience only.
  }
}

export async function loadLastGameRoom(game: OnlineGameId): Promise<SavedRoom | null> {
  try {
    const raw = await AsyncStorage.getItem(lastGameKey(game));
    return raw ? (JSON.parse(raw) as SavedRoom) : null;
  } catch {
    return null;
  }
}

const NAME_KEY = 'appli-poker:name';

/** The name chosen on the profile, used to fill in the lobbies. */
export async function saveName(name: string) {
  try {
    await AsyncStorage.setItem(NAME_KEY, name);
  } catch {
    // Remembering the name is a convenience only.
  }
}

export async function loadName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

const AVATAR_KEY = 'appli-poker:avatar';

export async function saveAvatar(avatar: Avatar) {
  try {
    await AsyncStorage.setItem(AVATAR_KEY, JSON.stringify(avatar));
  } catch {
    // Remembering the avatar is a convenience only.
  }
}

export async function loadAvatar(): Promise<Avatar | null> {
  try {
    const raw = await AsyncStorage.getItem(AVATAR_KEY);
    return raw ? (JSON.parse(raw) as Avatar) : null;
  } catch {
    return null;
  }
}

export interface PlayerStats {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  is_me: boolean;
  hands_played: number;
  hands_won: number;
  /** Chips won minus chips lost, over every online hand. */
  net: number;
  best_pot: number;
  games_played: number;
  games_won: number;
}

/** My statistics and those of everyone I have played with, best first. */
export async function loadStats(): Promise<PlayerStats[]> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc('player_stats');
  if (error) throw new Error(t('Impossible de charger les statistiques'));
  return (data as PlayerStats[]).sort((a, b) => b.net - a.net);
}

export interface Tournament {
  id: string;
  code: string;
  name: string;
  host_id: string;
  games: OnlineGameId[];
  status: 'open' | 'playing' | 'finished';
  /** Index in games of the game being played. */
  round: number;
  /** The table opened for this round, once the host created it. */
  room_id: string | null;
  room_code: string | null;
}

export interface TournamentPlayer {
  user_id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  points: number;
  wins: number;
}

/** A person (or robot) shown by the Friday tournament. */
export interface WeeklyPerson {
  id: string;
  name: string;
  avatar: string | null;
  avatar_color: string | null;
  bot?: boolean;
}

/** One Friday tournament, as the server shows it. */
export interface WeeklyInfo {
  id: string;
  friday: string;
  /** Epoch milliseconds. */
  startsAt: number;
  game: string;
  status: 'open' | 'running' | 'finished' | 'cancelled';
  bracket: WeeklyBracket | null;
  registered: number;
  /** I signed up. */
  me: boolean;
  entrants: WeeklyPerson[];
  winner: WeeklyPerson | null;
}

/** The Friday tournament: the next one, the one being played (or just played), past champions. */
export interface WeeklyState {
  /** The server's clock when it answered, to count down without trusting the phone's clock. */
  now: number;
  upcoming: WeeklyInfo;
  current: WeeklyInfo | null;
  past: { friday: string; game: string; players: number; winner: WeeklyPerson }[];
  hall: {
    user_id: string;
    name: string;
    avatar: string | null;
    avatar_color: string | null;
    bot: boolean;
    wins: number;
    last: string;
  }[];
}

export interface SavedTournament {
  id: string;
  name: string;
  code: string;
}

const TOURNAMENTS_KEY = 'appli-poker:tournaments';

/** The tournaments I created or joined on this phone, newest first. */
export async function loadSavedTournaments(): Promise<SavedTournament[]> {
  try {
    const raw = await AsyncStorage.getItem(TOURNAMENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as SavedTournament[]) : [];
  } catch {
    return [];
  }
}

export async function saveTournament(t: SavedTournament) {
  try {
    const others = (await loadSavedTournaments()).filter((x) => x.id !== t.id);
    await AsyncStorage.setItem(TOURNAMENTS_KEY, JSON.stringify([t, ...others].slice(0, 20)));
  } catch {
    // Remembering the tournament is a convenience only.
  }
}

export async function forgetTournament(id: string) {
  try {
    const list = (await loadSavedTournaments()).filter((x) => x.id !== id);
    await AsyncStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(list));
  } catch {
    // Nothing to do if storage is blocked.
  }
}
