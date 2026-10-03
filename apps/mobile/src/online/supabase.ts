import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Action, Avatar } from '@appli-poker/engine';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

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
    throw new Error('Connexion impossible. Les connexions anonymes sont-elles activées dans Supabase ?');
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
    }
  | { type: 'join'; name: string; code: string; avatar: Avatar }
  | { type: 'deal'; roomId: string }
  | { type: 'act'; roomId: string; action: Action }
  | { type: 'timeout'; roomId: string };

/** Calls the game server and turns its error replies into readable messages. */
export async function callServer<T>(body: Request): Promise<T> {
  await ensureSignedIn();
  const { data, error } = await supabase.functions.invoke('poker', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? 'Erreur du serveur');
    }
    throw new Error('Pas de connexion au serveur');
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
