// Messages between friends and who is online, followed live for the whole app.
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { callProfile, ensureSignedIn, supabase } from './supabase';
import { t } from '../i18n';

/** Longest message, as the server keeps them. */
export const DIRECT_MESSAGE_MAX = 500;

export interface DirectMessage {
  id: number;
  sender_id: string;
  recipient_id: string;
  body: string;
  /** An invitation to a table: its game and code. */
  game: string | null;
  room_code: string | null;
  created_at: string;
  read_at: string | null;
}

/** The last message with a friend and how many of theirs I have not read. */
export interface Conversation {
  friend_id: string;
  last_id: number;
  last_body: string;
  last_game: string | null;
  last_mine: boolean;
  last_at: string;
  last_read: boolean;
  unread: number;
}

const COLUMNS = 'id, sender_id, recipient_id, body, game, room_code, created_at, read_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let me: string | null = null;
let started = false;
let unread = 0;
let online: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const messageListeners = new Set<(m: DirectMessage) => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How many messages from friends I have not read yet. */
export async function refreshUnread() {
  try {
    me ??= await ensureSignedIn();
    const { count, error } = await supabase
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', me)
      .is('read_at', null);
    if (!error && typeof count === 'number' && count !== unread) {
      unread = count;
      emit();
    }
  } catch {
    // Offline: the badge stays as it was.
  }
}

function received(row: DirectMessage) {
  for (const l of messageListeners) l(row);
}

/** Starts following my messages and sharing that I am online. */
function start() {
  if (started) return;
  started = true;
  ensureSignedIn()
    .then((id) => {
      me = id;
      refreshUnread();
      const live = (payload: { new: unknown }) => received(payload.new as DirectMessage);
      supabase
        .channel(`messages:${id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${id}` },
          (payload) => {
            unread += 1;
            emit();
            live(payload);
          },
        )
        // My own invitations (written by the server) and "seen" marks on what I sent.
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${id}` },
          live,
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${id}` },
          live,
        )
        .subscribe();
      startPresence(id);
    })
    .catch(() => {
      started = false;
    });
}

// ---------------------------------------------------------------------------
// Who is online: everyone with the app open on screen shares their id on one presence channel.

let presence: RealtimeChannel | null = null;
let shown = true;

function onScreen(): boolean {
  if (Platform.OS === 'web') return typeof document === 'undefined' || document.visibilityState !== 'hidden';
  return AppState.currentState === 'active';
}

function share() {
  if (!presence) return;
  const visible = onScreen();
  if (visible === shown) return;
  shown = visible;
  if (visible) presence.track({ at: Date.now() }).catch(() => {});
  else presence.untrack().catch(() => {});
}

function startPresence(id: string) {
  const channel = supabase.channel('en-ligne', { config: { presence: { key: id } } });
  presence = channel;
  channel
    .on('presence', { event: 'sync' }, () => {
      online = new Set(Object.keys(channel.presenceState()));
      emit();
    })
    .subscribe((status) => {
      shown = onScreen();
      if (status === 'SUBSCRIBED' && shown) channel.track({ at: Date.now() }).catch(() => {});
    });
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', share);
  } else {
    AppState.addEventListener('change', share);
  }
}

// ---------------------------------------------------------------------------

/** Number of unread messages, for the badge on the friends button. */
export function useUnreadCount(): number {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => unread);
}

/** Ids of the players who have the app open right now. */
export function useOnline(): ReadonlySet<string> {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => online);
}

/** Calls back for every new message (sent or received) and every "seen" mark, live. */
export function useDirectMessages(onMessage: (m: DirectMessage) => void) {
  useEffect(() => {
    start();
    messageListeners.add(onMessage);
    return () => {
      messageListeners.delete(onMessage);
    };
  }, [onMessage]);
}

/** My conversations, newest first. */
export async function loadConversations(): Promise<Conversation[]> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw new Error(t('Pas de connexion au serveur'));
  return (data ?? []) as Conversation[];
}

/** The latest messages with a friend (oldest first), or those before `beforeId`. */
export async function loadThread(friendId: string, beforeId?: number): Promise<DirectMessage[]> {
  if (!UUID.test(friendId)) return [];
  me ??= await ensureSignedIn();
  let query = supabase
    .from('direct_messages')
    .select(COLUMNS)
    .or(
      `and(sender_id.eq.${me},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${me})`,
    )
    .order('id', { ascending: false })
    .limit(60);
  if (beforeId) query = query.lt('id', beforeId);
  const { data, error } = await query;
  if (error) throw new Error(t('Pas de connexion au serveur'));
  return ((data ?? []) as DirectMessage[]).reverse();
}

/** Sends a message to a friend; the server checks it and may tell their phone. */
export async function sendDirect(friendId: string, body: string): Promise<DirectMessage> {
  const { message } = await callProfile<{ message: DirectMessage }>({ type: 'message', friendId, body });
  return message;
}

/** Marks everything a friend sent me as read. */
export async function markRead(friendId: string) {
  if (!UUID.test(friendId)) return;
  try {
    await ensureSignedIn();
    const { data } = await supabase.rpc('read_messages', { p_friend: friendId });
    if (typeof data === 'number' && data > 0) {
      unread = Math.max(0, unread - data);
      emit();
    }
  } catch {
    // Offline: marked next time.
  }
  await refreshUnread();
}
