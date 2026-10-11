// Clubs: the club screen's data from the clubs server, the lounge followed live, and the small
// club badges shown next to players' names.
import { useEffect, useState } from 'react';
import type { ClubRole, DuelScore, LeaderboardPlayer } from '@appli-poker/engine';
import { callClubs, ensureSignedIn, supabase } from './supabase';
import { t } from '../i18n';

export interface ClubInfo {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  owner_id: string;
  created_at: string;
}

export type ClubMember = LeaderboardPlayer & { role: ClubRole; joined_at: string };

export interface TopClub {
  club_id: string;
  place: number;
  points: number;
  played: number;
  won: number;
  members: number;
  club: ClubInfo;
}

export interface ClubChallenge {
  id: string;
  week: string;
  from_club: string;
  to_club: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  answered_at: string | null;
  /** The score: live during the week, then the result. */
  result: DuelScore | null;
  /** My club sent it. */
  mine: boolean;
  other: ClubInfo | null;
}

export interface ClubInvite {
  club: ClubInfo;
  from_name: string;
  members: number;
  created_at: string;
}

/** Everything the club screen shows, as the server answers it. */
export interface ClubState {
  now: number;
  /** Mondays of this week and last week ("YYYY-MM-DD", Paris). */
  week: string;
  lastWeek: string;
  endsAt: number;
  top: TopClub[];
  lastTop: { club_id: string; place: number; points: number; members: number; club: ClubInfo | null }[];
  /** My chest for last week's club ranking. */
  chest: { kind: 'grand' | 'normal'; club_id: string; place: number; claimed: boolean } | null;
  club:
    | (ClubInfo & {
        code: string;
        points: number;
        /** My club's place among the clubs this week (null before its first point). */
        place: number | null;
        clubs: number;
      })
    | null;
  role: ClubRole | null;
  /** Without a club: the invitations I received. */
  invites?: ClubInvite[];
  /** In a club: */
  members?: ClubMember[];
  challenges?: ClubChallenge[];
  /** Friends already invited, waiting for their answer. */
  invited?: string[];
}

export interface ClubMessage {
  id: number;
  club_id: string;
  sender_id: string | null;
  kind: 'text' | 'invite' | 'event';
  body: string;
  game: string | null;
  room_code: string | null;
  created_at: string;
}

/** Longest message in the lounge. */
export const CLUB_MESSAGE_MAX = 500;

export function loadClubState() {
  return callClubs<ClubState>({ type: 'state' });
}

export function previewClub(code: string) {
  return callClubs<{ club: ClubInfo; members: number }>({ type: 'preview', code });
}

export async function createClub(look: { name: string; emoji: string; color: string; description: string }) {
  const res = await callClubs<{ id: string }>({ type: 'create', ...look });
  forgetBadges();
  return res;
}

export async function joinClub(by: { code: string } | { clubId: string }) {
  const res = await callClubs<{ id: string }>({ type: 'join', ...by });
  forgetBadges();
  return res;
}

export async function leaveClub() {
  await callClubs({ type: 'leave' });
  forgetBadges();
}

export async function deleteClub() {
  await callClubs({ type: 'delete' });
  forgetBadges();
}

export function editClub(look: { name: string; emoji: string; color: string; description: string }) {
  return callClubs({ type: 'edit', ...look });
}

export function newClubCode() {
  return callClubs<{ code: string }>({ type: 'newCode' });
}

export function kickMember(userId: string) {
  return callClubs({ type: 'kick', userId });
}

export function setMemberRole(userId: string, role: 'admin' | 'member') {
  return callClubs({ type: 'role', userId, role });
}

export function transferClub(userId: string) {
  return callClubs({ type: 'transfer', userId });
}

export function inviteToClub(friendId: string) {
  return callClubs({ type: 'invite', friendId });
}

export function declineClubInvite(clubId: string) {
  return callClubs({ type: 'decline', clubId });
}

export async function sendClubMessage(body: string) {
  const { message } = await callClubs<{ message: ClubMessage }>({ type: 'message', body });
  return message;
}

/** Invites the whole club to my table: a card in the lounge and a notification. */
export function inviteClubToTable(game: string, code: string) {
  return callClubs<{ message: ClubMessage; notified: number }>({ type: 'inviteGame', game, code });
}

export function challengeClub(clubId: string) {
  return callClubs<{ id: string }>({ type: 'challenge', clubId });
}

export function answerChallenge(challengeId: string, accept: boolean) {
  return callClubs({ type: 'answer', challengeId, accept });
}

export function cancelChallenge(challengeId: string) {
  return callClubs({ type: 'cancelChallenge', challengeId });
}

export function claimClubChest() {
  return callClubs({ type: 'chest' });
}

const MESSAGE_COLUMNS = 'id, club_id, sender_id, kind, body, game, room_code, created_at';

/** The latest messages of my club's lounge (oldest first), or those before `beforeId`. */
export async function loadClubMessages(clubId: string, beforeId?: number): Promise<ClubMessage[]> {
  await ensureSignedIn();
  let query = supabase
    .from('club_messages')
    .select(MESSAGE_COLUMNS)
    .eq('club_id', clubId)
    .order('id', { ascending: false })
    .limit(60);
  if (beforeId) query = query.lt('id', beforeId);
  const { data, error } = await query;
  if (error) throw new Error(t('Pas de connexion au serveur'));
  return ((data ?? []) as ClubMessage[]).reverse();
}

/**
 * Follows my club live: new messages in the lounge, and any change of members or challenges
 * (then `onChange`, to load the club again).
 */
export function useClubLive(
  clubId: string | null,
  onMessage: (m: ClubMessage) => void,
  onChange: () => void,
) {
  useEffect(() => {
    if (!clubId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Several changes at once (a challenge answered writes in both lounges) load once.
    const changed = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onChange, 400);
    };
    const channel = supabase
      .channel(`club:${clubId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'club_messages', filter: `club_id=eq.${clubId}` },
        (payload) => {
          const m = payload.new as ClubMessage;
          onMessage(m);
          if (m.kind === 'event') changed();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${clubId}` },
        changed,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'club_challenges', filter: `to_club=eq.${clubId}` },
        changed,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'club_challenges', filter: `from_club=eq.${clubId}` },
        changed,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [clubId, onMessage, onChange]);
}

// ---------------------------------------------------------------------------
// Club badges next to names: read once per player and kept for the session.

export interface ClubBadgeInfo {
  club_id: string;
  name: string;
  emoji: string;
  color: string;
}

const badges = new Map<string, ClubBadgeInfo | null>();
const badgeListeners = new Set<() => void>();
let badgeVersion = 0;

function forgetBadges() {
  badges.clear();
  badgeVersion++;
  badgeListeners.forEach((l) => l());
}

async function fetchBadges(ids: string[]) {
  const missing = ids.filter((id) => !badges.has(id));
  if (missing.length === 0) return;
  for (const id of missing) badges.set(id, null);
  try {
    await ensureSignedIn();
    const { data, error } = await supabase
      .from('club_members')
      .select('user_id, club_id, clubs(name, emoji, color)')
      .in('user_id', missing);
    if (error) throw error;
    for (const row of (data ?? []) as unknown as {
      user_id: string;
      club_id: string;
      clubs: { name: string; emoji: string; color: string } | null;
    }[]) {
      if (row.clubs) badges.set(row.user_id, { club_id: row.club_id, ...row.clubs });
    }
  } catch {
    // No badge this time: asked again next session.
  }
  badgeListeners.forEach((l) => l());
}

/** The club of each of these players (null without a club). */
export function useClubBadges(ids: string[]): Record<string, ClubBadgeInfo | null> {
  const key = ids.slice().sort().join(',');
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    badgeListeners.add(listener);
    if (key) fetchBadges(key.split(','));
    return () => {
      badgeListeners.delete(listener);
    };
  }, [key, badgeVersion]);
  const out: Record<string, ClubBadgeInfo | null> = {};
  for (const id of ids) out[id] = badges.get(id) ?? null;
  return out;
}

/** My club's badge, for my profile. */
export function useMyClubBadge(): ClubBadgeInfo | null {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    ensureSignedIn()
      .then(setMe)
      .catch(() => {});
  }, []);
  return useClubBadges(me ? [me] : [])[me ?? ''] ?? null;
}

/** Club changes made on this screen show at once in the badges elsewhere. */
export function refreshClubBadges() {
  forgetBadges();
}
