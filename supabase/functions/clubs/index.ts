// Clubs server: creating and joining a club, its members and roles, the lounge, the weekly
// club ranking with its chest, and challenges between clubs. Players only read the club
// tables; every change goes through here.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CLUB_MAX_INVITES,
  CLUB_MAX_MEMBERS,
  type ClubChallengeRow,
  type ClubRole,
  challengeRefusal,
  parisDay,
  previousWeek,
  rankClubs,
  weekEndsAt,
  weekStart,
} from '../_shared/engine/index.ts';
import { GameError, makeRoomCode } from '../poker/logic.ts';
import { inBackground, notify } from '../_shared/push.ts';
import {
  type NoticeLang,
  clubAcceptedNotice,
  clubChallengeNotice,
  clubInviteNotice,
  inviteNotice,
} from '../_shared/notify.ts';
import { MESSAGE_HOURLY, canSendMessage, cleanMessage, cleanUserId } from '../_shared/messagerie.ts';
import { myTable } from '../_shared/tables.ts';
import {
  type ClubEvent,
  type ClubTallyRow,
  type ClubWeekRow,
  type MemberRow,
  canInviteClubToTable,
  canInviteToClubAgain,
  challengeScore,
  cleanNewRole,
  clubCode,
  clubLook,
  clubMembers,
  cleanId,
  clubWeekRows,
  eventBody,
  mustBeAllowed,
  mustSwitch,
  myClubChest,
  parisMidnight,
} from './logic.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Columns of a club anyone may see (the code is for members only). */
const CLUB_PUBLIC = 'id, name, emoji, color, description, owner_id, created_at';
const MESSAGE_COLUMNS = 'id, club_id, sender_id, kind, body, game, room_code, created_at';

interface ClubRow {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  owner_id: string;
  created_at: string;
  code?: string;
}

/** Calls a database function that answers either a result or {error} for the player. */
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  if (data?.error) throw new GameError(data.error);
  return data;
}

/** My club and my role in it, or null. */
async function membership(userId: string): Promise<{ club_id: string; role: ClubRole } | null> {
  const { data, error } = await admin
    .from('club_members')
    .select('club_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as { club_id: string; role: ClubRole } | null;
}

async function mustBeMember(userId: string) {
  const m = await membership(userId);
  if (!m) throw new GameError('Tu n’es dans aucun club');
  return m;
}

/** A member of my club, with their role. */
async function memberOf(clubId: string, raw: unknown) {
  const id = cleanUserId(raw);
  const { data } = await admin
    .from('club_members')
    .select('user_id, role')
    .eq('club_id', clubId)
    .eq('user_id', id)
    .maybeSingle();
  if (!data) throw new GameError('Ce joueur n’est pas dans ton club');
  return data as { user_id: string; role: ClubRole };
}

async function clubById(id: string): Promise<ClubRow | null> {
  const { data, error } = await admin.from('clubs').select(CLUB_PUBLIC).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as ClubRow | null;
}

async function nameOf(userId: string): Promise<string> {
  const { data } = await admin.from('profiles').select('name').eq('user_id', userId).maybeSingle();
  return (data?.name as string | undefined) || 'Joueur';
}

/** Writes what happened in the lounge (never stops the action it tells about). */
async function event(clubId: string, who: string | null, what: ClubEvent, club?: string) {
  const { error } = await admin
    .from('club_messages')
    .insert({ club_id: clubId, sender_id: who, kind: 'event', body: eventBody(what, club) });
  if (error) console.error('événement du club non écrit', error.message);
}

async function members(clubId: string, roles?: ClubRole[]): Promise<string[]> {
  let q = admin.from('club_members').select('user_id').eq('club_id', clubId);
  if (roles) q = q.in('role', roles);
  const { data } = await q;
  return (data ?? []).map((r) => r.user_id as string);
}

function tell(ids: string[], build: (lang: NoticeLang) => ReturnType<typeof clubInviteNotice>) {
  if (ids.length === 0) return;
  inBackground(notify(admin, ids, build, { ttl: 86_400, urgency: 'normal' }));
}

async function lastLeft(userId: string): Promise<string | null> {
  const { data } = await admin
    .from('player_progress')
    .select('club_left_at')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.club_left_at as string | null | undefined) ?? null;
}

async function markLeft(userId: string) {
  await admin
    .from('player_progress')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  await admin
    .from('player_progress')
    .update({ club_left_at: new Date().toISOString() })
    .eq('user_id', userId);
}

// ---------------------------------------------------------------------------
// The weeks: this week's ranking, last week's (kept once) and the challenges' results.

async function weekTallies(week: string, before?: number): Promise<ClubTallyRow[]> {
  const { data, error } = await admin.rpc('club_week_tallies', {
    p_week: week,
    p_before: before ? new Date(before).toISOString() : null,
  });
  if (error) throw error;
  return (data ?? []) as ClubTallyRow[];
}

/** Last week's club ranking: written on the first request of the new week, then read. */
async function lastWeekRanking(monday: string): Promise<ClubWeekRow[]> {
  const week = previousWeek(monday);
  const { data, error } = await admin
    .from('club_weeks')
    .select('week, club_id, place, points, members')
    .eq('week', week);
  if (error) throw error;
  if (data && data.length > 0) return data as ClubWeekRow[];
  // Only those who were members before the week ended count, and win the chest.
  const rows = clubWeekRows(week, await weekTallies(week, parisMidnight(monday)));
  if (rows.length === 0) return [];
  const { error: saveError } = await admin
    .from('club_weeks')
    .upsert(rows, { onConflict: 'week,club_id', ignoreDuplicates: true });
  if (saveError) throw saveError;
  const { data: kept } = await admin
    .from('club_weeks')
    .select('week, club_id, place, points, members')
    .eq('week', week);
  return (kept ?? rows) as ClubWeekRow[];
}

/** The score of a challenge between two clubs in a week. */
async function score(c: ClubChallengeRow, tallies?: ClubTallyRow[]) {
  const all = tallies ?? (await weekTallies(c.week));
  const { data: duel, error } = await admin.rpc('club_duel_tallies', {
    p_a: c.from_club,
    p_b: c.to_club,
    p_week: c.week,
  });
  if (error) throw error;
  return challengeScore(
    all.find((t) => t.club_id === c.from_club),
    all.find((t) => t.club_id === c.to_club),
    (duel ?? [])[0],
  );
}

type ChallengeRow = ClubChallengeRow & {
  created_at: string;
  answered_at: string | null;
  result: unknown;
};

/** My club's challenges of this week and last week; finished ones get their result once. */
async function myChallenges(clubId: string, monday: string, tallies: ClubTallyRow[]) {
  const { data, error } = await admin
    .from('club_challenges')
    .select('id, week, from_club, to_club, status, created_at, answered_at, result')
    .or(`from_club.eq.${clubId},to_club.eq.${clubId}`)
    .in('week', [monday, previousWeek(monday)])
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ChallengeRow[];
  for (const c of rows) {
    if (c.status !== 'accepted') continue;
    if (c.week === monday) c.result = await score(c, tallies);
    else if (!c.result) {
      const result = await score(c);
      await admin.from('club_challenges').update({ result }).eq('id', c.id).is('result', null);
      c.result = result;
    }
  }
  const others = [...new Set(rows.map((c) => (c.from_club === clubId ? c.to_club : c.from_club)))];
  const { data: clubs } = others.length
    ? await admin.from('clubs').select(CLUB_PUBLIC).in('id', others)
    : { data: [] };
  return (
    rows
      // Last week's unanswered or refused challenges are no use any more.
      .filter((c) => c.week === monday || c.status === 'accepted')
      .map((c) => {
        const mine = c.from_club === clubId;
        return {
          ...c,
          mine,
          other: (clubs ?? []).find((x) => x.id === (mine ? c.to_club : c.from_club)) ?? null,
        };
      })
  );
}

// ---------------------------------------------------------------------------

/** Everything the club screen shows, in one request. */
async function state(userId: string) {
  const now = Date.now();
  const monday = weekStart(parisDay());
  const [m, tallies, lastWeek, progress] = await Promise.all([
    membership(userId),
    weekTallies(monday),
    lastWeekRanking(monday),
    admin.from('player_progress').select('club_chest_claimed').eq('user_id', userId).maybeSingle(),
  ]);
  const ranking = rankClubs(tallies);
  const topIds = ranking.slice(0, 20).map((l) => l.club_id);
  const lastTop = lastWeek.filter((r) => r.place <= 3 && r.points > 0).sort((a, b) => a.place - b.place);
  const wanted = [...new Set([...topIds, ...lastTop.map((r) => r.club_id), ...(m ? [m.club_id] : [])])];
  const { data: clubRows } = wanted.length
    ? await admin.from('clubs').select(CLUB_PUBLIC).in('id', wanted)
    : { data: [] };
  const byId = new Map((clubRows ?? []).map((c) => [c.id as string, c]));
  const top = ranking
    .filter((l) => byId.has(l.club_id))
    .slice(0, 20)
    .map((l) => ({ ...l, club: byId.get(l.club_id) }));

  const chest = myClubChest(lastWeek, userId);
  const base = {
    now,
    week: monday,
    lastWeek: previousWeek(monday),
    endsAt: weekEndsAt(now),
    top,
    lastTop: lastTop.map((r) => ({ ...r, members: r.members.length, club: byId.get(r.club_id) ?? null })),
    chest: chest ? { ...chest, claimed: progress.data?.club_chest_claimed === previousWeek(monday) } : null,
  };

  if (!m) {
    const { data: invites } = await admin
      .from('club_invites')
      .select('club_id, from_id, created_at')
      .eq('to_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    const ids = (invites ?? []).map((i) => i.club_id as string);
    const [clubs, names, counts] = await Promise.all([
      ids.length ? admin.from('clubs').select(CLUB_PUBLIC).in('id', ids) : Promise.resolve({ data: [] }),
      ids.length
        ? admin
            .from('profiles')
            .select('user_id, name')
            .in(
              'user_id',
              (invites ?? []).map((i) => i.from_id as string),
            )
        : Promise.resolve({ data: [] }),
      ids.length
        ? admin.from('club_members').select('club_id').in('club_id', ids)
        : Promise.resolve({ data: [] }),
    ]);
    return {
      ...base,
      club: null,
      role: null,
      invites: (invites ?? [])
        .map((i) => ({
          club: (clubs.data ?? []).find((c: ClubRow) => c.id === i.club_id),
          from_name:
            (names.data ?? []).find((n: { user_id: string }) => n.user_id === i.from_id)?.name ?? 'Joueur',
          members: (counts.data ?? []).filter((c: { club_id: string }) => c.club_id === i.club_id).length,
          created_at: i.created_at,
        }))
        .filter((i) => i.club),
    };
  }

  const { data: club, error } = await admin
    .from('clubs')
    .select(`${CLUB_PUBLIC}, code`)
    .eq('id', m.club_id)
    .single();
  if (error) throw error;
  const { data: rows } = await admin
    .from('club_members')
    .select('user_id, role, joined_at')
    .eq('club_id', m.club_id);
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const [profiles, progressRows, results, challenges, invited] = await Promise.all([
    admin.from('profiles').select('user_id, name, avatar, avatar_color').in('user_id', ids),
    admin
      .from('player_progress')
      .select('user_id, xp, equipped, owned, week_start, week_xp, last_week_start, last_week_xp')
      .in('user_id', ids),
    admin
      .from('online_results')
      .select('user_id, game, won, week')
      .in('user_id', ids)
      .in('week', [monday, previousWeek(monday)]),
    myChallenges(m.club_id, monday, tallies),
    admin.from('club_invites').select('to_id').eq('club_id', m.club_id),
  ]);
  for (const r of [profiles, progressRows, results]) if (r.error) throw r.error;
  const people: MemberRow[] = (rows ?? []).map((r) => ({
    ...(progressRows.data ?? []).find((p) => p.user_id === r.user_id),
    ...(profiles.data ?? []).find((p) => p.user_id === r.user_id),
    user_id: r.user_id as string,
    role: r.role as string,
    joined_at: r.joined_at as string,
  }));
  const line = ranking.find((l) => l.club_id === m.club_id);
  return {
    ...base,
    club: {
      ...club,
      points: line?.points ?? 0,
      place: line && line.points > 0 ? line.place : null,
      clubs: ranking.length,
    },
    role: m.role,
    members: clubMembers(userId, people, results.data ?? [], monday),
    challenges,
    invited: (invited.data ?? []).map((i) => i.to_id as string),
  };
}

/** A club by its code, before joining it (from a link or a typed code). */
async function preview(body: Record<string, unknown>) {
  const code = clubCode(body.code);
  const { data } = await admin.from('clubs').select(CLUB_PUBLIC).eq('code', code).maybeSingle();
  if (!data) throw new GameError('Aucun club avec ce code');
  const { count } = await admin
    .from('club_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('club_id', data.id);
  return { club: data, members: count ?? 0 };
}

async function create(userId: string, body: Record<string, unknown>) {
  const look = clubLook(body);
  mustSwitch(await lastLeft(userId), Date.now());
  for (let attempt = 0; attempt < 5; attempt++) {
    const data = await rpc('club_create', {
      p_user: userId,
      p_name: look.name,
      p_emoji: look.emoji,
      p_color: look.color,
      p_description: look.description,
      p_code: makeRoomCode(),
    });
    if (data?.retry) continue;
    await event(data.id, userId, 'creation');
    return { id: data.id };
  }
  throw new GameError('Impossible de créer le club, réessaie');
}

async function join(userId: string, body: Record<string, unknown>) {
  if (await membership(userId)) throw new GameError('Quitte d’abord ton club');
  mustSwitch(await lastLeft(userId), Date.now());
  let clubId: string;
  if (body.code !== undefined) {
    const code = clubCode(body.code);
    const { data } = await admin.from('clubs').select('id').eq('code', code).maybeSingle();
    if (!data) throw new GameError('Aucun club avec ce code');
    clubId = data.id as string;
  } else {
    // Joining from an invitation, without the code.
    clubId = cleanId(body.clubId, 'Cette invitation n’est plus valable');
    const { data } = await admin
      .from('club_invites')
      .select('club_id')
      .eq('club_id', clubId)
      .eq('to_id', userId)
      .maybeSingle();
    if (!data) throw new GameError('Cette invitation n’est plus valable');
  }
  const { count } = await admin
    .from('club_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('club_id', clubId);
  if ((count ?? 0) >= CLUB_MAX_MEMBERS) throw new GameError('Ce club est complet (30 membres)');
  const { error } = await admin
    .from('club_members')
    .insert({ user_id: userId, club_id: clubId, role: 'member' });
  if (error?.code === '23505') throw new GameError('Quitte d’abord ton club');
  if (error?.code === 'P0001') throw new GameError(error.message);
  if (error) throw error;
  await admin.from('club_invites').delete().eq('to_id', userId);
  await event(clubId, userId, 'arrivee');
  return { id: clubId };
}

async function leave(userId: string) {
  const m = await mustBeMember(userId);
  const others = (await members(m.club_id)).filter((id) => id !== userId);
  mustBeAllowed(m.role, 'leave', undefined, others.length === 0);
  if (others.length === 0) {
    // The last one out closes the club.
    const { error } = await admin.from('clubs').delete().eq('id', m.club_id);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from('club_members')
      .delete()
      .eq('user_id', userId)
      .eq('club_id', m.club_id);
    if (error) throw error;
    await event(m.club_id, userId, 'depart');
  }
  await markLeft(userId);
  return { ok: true };
}

async function kick(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  const target = await memberOf(m.club_id, body.userId);
  mustBeAllowed(m.role, 'kick', target.role);
  const { error } = await admin
    .from('club_members')
    .delete()
    .eq('user_id', target.user_id)
    .eq('club_id', m.club_id)
    .eq('role', target.role);
  if (error) throw error;
  await event(m.club_id, target.user_id, 'exclusion');
  return { ok: true };
}

async function setRole(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  const target = await memberOf(m.club_id, body.userId);
  const role = cleanNewRole(body.role);
  mustBeAllowed(m.role, role === 'admin' ? 'promote' : 'demote', target.role);
  const { error } = await admin
    .from('club_members')
    .update({ role })
    .eq('user_id', target.user_id)
    .eq('club_id', m.club_id)
    .neq('role', 'owner');
  if (error) throw error;
  if (role === 'admin') await event(m.club_id, target.user_id, 'admin');
  return { ok: true };
}

async function transfer(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  const target = await memberOf(m.club_id, body.userId);
  mustBeAllowed(m.role, 'transfer', target.role);
  await rpc('club_transfer', { p_club: m.club_id, p_from: userId, p_to: target.user_id });
  await event(m.club_id, target.user_id, 'createur');
  return { ok: true };
}

async function edit(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  mustBeAllowed(m.role, 'edit');
  const look = clubLook(body);
  const { error } = await admin.from('clubs').update(look).eq('id', m.club_id);
  if (error?.code === '23505') throw new GameError('Ce nom de club est déjà pris');
  if (error) throw error;
  return { ok: true };
}

async function newCode(userId: string) {
  const m = await mustBeMember(userId);
  mustBeAllowed(m.role, 'newCode');
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const { error } = await admin.from('clubs').update({ code }).eq('id', m.club_id);
    if (error?.code === '23505') continue;
    if (error) throw error;
    return { code };
  }
  throw new GameError('Impossible de changer le code, réessaie');
}

async function remove(userId: string) {
  const m = await mustBeMember(userId);
  mustBeAllowed(m.role, 'delete');
  const ids = await members(m.club_id);
  const { error } = await admin.from('clubs').delete().eq('id', m.club_id);
  if (error) throw error;
  await markLeft(userId);
  return { ok: true, members: ids.length };
}

/** Invites a friend into my club: a line in their club screen and a notification. */
async function invite(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  mustBeAllowed(m.role, 'invite');
  const friendId = cleanUserId(body.friendId);
  const { data: friendship } = await admin
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .maybeSingle();
  if (!friendship) throw new GameError('Ce joueur n’est pas dans tes amis');
  const { data: already } = await admin
    .from('club_members')
    .select('club_id')
    .eq('user_id', friendId)
    .maybeSingle();
  if (already?.club_id === m.club_id) throw new GameError('Ce joueur est déjà dans ton club');
  if (already) throw new GameError('Ce joueur est déjà dans un autre club');
  const { data: pending } = await admin
    .from('club_invites')
    .select('to_id, created_at')
    .eq('club_id', m.club_id);
  const last = (pending ?? []).find((p) => p.to_id === friendId);
  if (last && !canInviteToClubAgain(last.created_at as string, Date.now())) {
    throw new GameError('Invitation déjà envoyée');
  }
  if (!last && (pending ?? []).length >= CLUB_MAX_INVITES) {
    throw new GameError('Trop d’invitations en attente pour ce club');
  }
  const { error } = await admin.from('club_invites').upsert({
    club_id: m.club_id,
    to_id: friendId,
    from_id: userId,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  const [club, from] = await Promise.all([clubById(m.club_id), nameOf(userId)]);
  if (club) tell([friendId], (lang) => clubInviteNotice(lang, from, club.name, club.emoji));
  return { ok: true };
}

async function decline(userId: string, body: Record<string, unknown>) {
  const clubId = cleanId(body.clubId, 'Cette invitation n’est plus valable');
  await admin.from('club_invites').delete().eq('to_id', userId).eq('club_id', clubId);
  return { ok: true };
}

/** Writes in the lounge. */
async function message(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  const text = cleanMessage(body.body);
  const now = Date.now();
  const { data: recent, error: recentError } = await admin
    .from('club_messages')
    .select('created_at')
    .eq('sender_id', userId)
    .eq('kind', 'text')
    .gt('created_at', new Date(now - 3_600_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(MESSAGE_HOURLY);
  if (recentError) throw recentError;
  if (
    !canSendMessage(
      (recent ?? []).map((r) => r.created_at as string),
      now,
    )
  ) {
    throw new GameError('Doucement ! Attends un peu avant d’écrire encore');
  }
  const { data, error } = await admin
    .from('club_messages')
    .insert({ club_id: m.club_id, sender_id: userId, kind: 'text', body: text })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return { message: data };
}

/** Invites the whole club to my table: a card in the lounge and a notification to the others. */
async function inviteGame(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  const game = String(body.game ?? '');
  const code = String(body.code ?? '')
    .trim()
    .toUpperCase();
  if (!/^[a-z0-9]{1,20}$/.test(game) || !/^[A-Z0-9]{4,8}$/.test(code)) {
    throw new GameError('Aucune table avec ce code');
  }
  const { name } = await myTable(admin, userId, game, code);
  const { data: last } = await admin
    .from('club_messages')
    .select('created_at')
    .eq('sender_id', userId)
    .eq('kind', 'invite')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!canInviteClubToTable(last?.created_at as string | undefined, Date.now())) {
    throw new GameError('Invitation déjà envoyée, patiente une minute');
  }
  const { data, error } = await admin
    .from('club_messages')
    .insert({ club_id: m.club_id, sender_id: userId, kind: 'invite', game, room_code: code })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  const others = (await members(m.club_id)).filter((id) => id !== userId);
  if (others.length > 0) {
    inBackground(
      notify(admin, others, (lang) => inviteNotice(lang, name, game, code), { ttl: 1800, urgency: 'high' }),
    );
  }
  return { message: data, notified: others.length };
}

async function challenge(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  mustBeAllowed(m.role, 'challenge');
  const otherId = cleanId(body.clubId, 'Ce club n’existe plus');
  const other = await clubById(otherId);
  if (!other) throw new GameError('Ce club n’existe plus');
  const week = weekStart(parisDay());
  const { data: rows, error } = await admin
    .from('club_challenges')
    .select('id, week, from_club, to_club, status')
    .eq('week', week)
    .or(`from_club.in.(${m.club_id},${otherId}),to_club.in.(${m.club_id},${otherId})`);
  if (error) throw error;
  const refusal = challengeRefusal(m.club_id, otherId, week, (rows ?? []) as ClubChallengeRow[]);
  if (refusal) throw new GameError(refusal);
  const { data: created, error: insertError } = await admin
    .from('club_challenges')
    .insert({ week, from_club: m.club_id, to_club: otherId, created_by: userId })
    .select('id')
    .single();
  if (insertError?.code === '23505')
    throw new GameError('Un défi entre ces deux clubs existe déjà cette semaine');
  if (insertError) throw insertError;
  const mine = await clubById(m.club_id);
  await event(m.club_id, userId, 'defi_lance', other.name);
  if (mine) {
    await event(otherId, null, 'defi_recu', mine.name);
    tell(await members(otherId, ['owner', 'admin']), (lang) =>
      clubChallengeNotice(lang, mine.name, mine.emoji),
    );
  }
  return { id: created.id };
}

async function answer(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  mustBeAllowed(m.role, 'challenge');
  const id = cleanId(body.challengeId, 'Ce défi n’attend plus de réponse');
  const accept = body.accept === true;
  const week = weekStart(parisDay());
  const { data: c } = await admin
    .from('club_challenges')
    .select('id, week, from_club, to_club, status')
    .eq('id', id)
    .maybeSingle();
  if (!c || c.to_club !== m.club_id || c.status !== 'pending' || c.week !== week) {
    throw new GameError('Ce défi n’attend plus de réponse');
  }
  if (accept) {
    const { data: rows } = await admin
      .from('club_challenges')
      .select('id, week, from_club, to_club, status')
      .eq('week', week)
      .eq('status', 'accepted')
      .or(`from_club.in.(${c.from_club},${c.to_club}),to_club.in.(${c.from_club},${c.to_club})`);
    const refusal = challengeRefusal(
      c.from_club,
      c.to_club,
      week,
      ((rows ?? []) as ClubChallengeRow[]).filter((r) => r.id !== c.id),
    );
    if (refusal) throw new GameError(refusal);
  }
  const { data: done, error } = await admin
    .from('club_challenges')
    .update({ status: accept ? 'accepted' : 'declined', answered_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  if (!done?.length) throw new GameError('Ce défi n’attend plus de réponse');
  const [from, to] = await Promise.all([clubById(c.from_club), clubById(c.to_club)]);
  if (from && to) {
    const what = accept ? 'defi_accepte' : 'defi_refuse';
    await event(c.from_club, null, what, to.name);
    await event(c.to_club, userId, what, from.name);
    if (accept) {
      tell(await members(c.from_club), (lang) => clubAcceptedNotice(lang, to.name, to.emoji));
      tell(
        (await members(c.to_club)).filter((x) => x !== userId),
        (lang) => clubAcceptedNotice(lang, from.name, from.emoji),
      );
    }
  }
  return { ok: true };
}

async function cancelChallenge(userId: string, body: Record<string, unknown>) {
  const m = await mustBeMember(userId);
  mustBeAllowed(m.role, 'challenge');
  const id = cleanId(body.challengeId, 'Ce défi n’attend plus de réponse');
  const { data, error } = await admin
    .from('club_challenges')
    .update({ status: 'cancelled', answered_at: new Date().toISOString() })
    .eq('id', id)
    .eq('from_club', m.club_id)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new GameError('Ce défi n’attend plus de réponse');
  return { ok: true };
}

/** Last week's club chest, taken once (`claim_club_chest` checks it). */
async function chest(userId: string) {
  const monday = weekStart(parisDay());
  const mine = myClubChest(await lastWeekRanking(monday), userId);
  if (!mine) throw new GameError('Pas de coffre de club pour toi cette semaine');
  return await rpc('claim_club_chest', { p_user: userId, p_kind: mine.kind, p_week: previousWeek(monday) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'Connexion requise' }, 401);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    switch (body.type) {
      case 'state':
        return json(await state(user.id));
      case 'preview':
        return json(await preview(body));
      case 'create':
        return json(await create(user.id, body));
      case 'join':
        return json(await join(user.id, body));
      case 'leave':
        return json(await leave(user.id));
      case 'kick':
        return json(await kick(user.id, body));
      case 'role':
        return json(await setRole(user.id, body));
      case 'transfer':
        return json(await transfer(user.id, body));
      case 'edit':
        return json(await edit(user.id, body));
      case 'newCode':
        return json(await newCode(user.id));
      case 'delete':
        return json(await remove(user.id));
      case 'invite':
        return json(await invite(user.id, body));
      case 'decline':
        return json(await decline(user.id, body));
      case 'message':
        return json(await message(user.id, body));
      case 'inviteGame':
        return json(await inviteGame(user.id, body));
      case 'challenge':
        return json(await challenge(user.id, body));
      case 'answer':
        return json(await answer(user.id, body));
      case 'cancelChallenge':
        return json(await cancelChallenge(user.id, body));
      case 'chest':
        return json(await chest(user.id));
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
