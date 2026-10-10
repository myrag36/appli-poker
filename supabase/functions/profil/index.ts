// Profile server: records games played on one phone, changes what a player wears, sells
// shop items and pays finished quests and daily challenges.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CHALLENGE_STREAK_MAX,
  CHALLENGE_STREAK_STEP,
  XP_DAILY,
  cleanAvatar,
  defaultAvatar,
  parisDay,
  previousWeek,
  weekStart,
} from '../_shared/engine/index.ts';
import { GameError, cleanName, makeRoomCode } from '../poker/logic.ts';
import { levelChests, unlockedEmojis } from '../_shared/xp.ts';
import { notify, vapidKeys } from '../_shared/push.ts';
import { MAX_SUBSCRIPTIONS, canInviteAgain, cleanSubscription, inviteNotice } from '../_shared/notify.ts';
import {
  chestContents,
  cleanFeat,
  cleanFriendCode,
  podiumChest,
  equip,
  finishedQuest,
  finishedChallenge,
  localGame,
  reachedAchievement,
  unlocksDue,
  shopItem,
  weeklyLeaderboard,
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

async function loadProgress(userId: string) {
  const { data, error } = await admin
    .from('player_progress')
    .select('xp, equipped, owned, stats_day, day_stats, games, best_streak, quests_done, feats, challenges_done')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (
    data ?? {
      xp: 0,
      equipped: {},
      owned: [],
      stats_day: null,
      day_stats: {},
      games: {},
      best_streak: 0,
      quests_done: 0,
      feats: [],
      challenges_done: 0,
    }
  );
}

async function wear(userId: string, body: Record<string, unknown>) {
  const progress = await loadProgress(userId);
  const equipped = equip(progress.xp, progress.equipped, body.slot, body.id, progress.owned);
  const { error } = await admin
    .from('player_progress')
    .upsert({ user_id: userId, equipped, updated_at: new Date().toISOString() });
  if (error) throw error;
  return { equipped };
}

async function local(userId: string, body: Record<string, unknown>) {
  const g = localGame(body.game, body.won);
  const { data, error } = await admin.rpc('award_local_game', {
    p_user: userId,
    p_game: g.game,
    p_amount: g.amount,
    p_won: g.won,
    p_daily: XP_DAILY,
    p_coins: g.coins,
  });
  if (error) throw error;
  await levelChests(admin, userId, data);
  return data;
}

/** Calls a database function that answers either a result or {error} for the player. */
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  if (data?.error) throw new GameError(data.error);
  return data;
}

async function buy(userId: string, body: Record<string, unknown>) {
  const item = shopItem(body.kind, body.id);
  return await rpc('buy_item', { p_user: userId, p_item: item.key, p_price: item.price });
}

async function claim(userId: string, body: Record<string, unknown>) {
  const day = parisDay();
  const progress = await loadProgress(userId);
  const quest = finishedQuest(day, body.quest, progress.stats_day, progress.day_stats);
  return await rpc('claim_quest', { p_user: userId, p_day: day, p_quest: quest.id, p_coins: quest.coins });
}

async function claimChallenge(userId: string) {
  const day = parisDay();
  const progress = await loadProgress(userId);
  const c = finishedChallenge(day, progress.stats_day, progress.day_stats, progress.games);
  return await rpc('claim_challenge', {
    p_user: userId,
    p_day: day,
    p_coins: c.coins,
    p_step: CHALLENGE_STREAK_STEP,
    p_cap: CHALLENGE_STREAK_MAX,
  });
}

async function openChest(userId: string, body: Record<string, unknown>) {
  const { data, error } = await admin
    .from('player_progress')
    .select('chests, owned')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const chest = ((data?.chests ?? []) as { id: string; kind: string }[]).find((c) => c.id === body.chest);
  if (!chest) throw new GameError('Coffre déjà ouvert');
  const got = chestContents(chest.kind, data?.owned, Math.random);
  return await rpc('open_chest', { p_user: userId, p_chest: chest.id, p_coins: got.coins, p_item: got.item });
}

async function achieve(userId: string, body: Record<string, unknown>) {
  const a = reachedAchievement(body.id, await loadProgress(userId));
  return await rpc('claim_achievement', { p_user: userId, p_id: a.id, p_coins: a.coins });
}

/**
 * Adds to my collection the items I earned by playing (an achievement reached, daily
 * challenges taken), checked here from my progress. They cost nothing: buy_item at price 0.
 */
async function unlock(userId: string) {
  const due = unlocksDue(await loadProgress(userId));
  const unlocked: string[] = [];
  for (const key of due) {
    const { data, error } = await admin.rpc('buy_item', { p_user: userId, p_item: key, p_price: 0 });
    if (error) throw error;
    if (!data?.error) unlocked.push(key);
  }
  return { unlocked };
}

async function feat(userId: string, body: Record<string, unknown>) {
  const { error } = await admin.rpc('add_feat', { p_user: userId, p_feat: cleanFeat(body.feat) });
  if (error) throw error;
  return { ok: true };
}

/** My friend code (made on first use), after saving the name and avatar friends will see. */
async function me(userId: string, body: Record<string, unknown>) {
  if (body.name) {
    const avatar = cleanAvatar(body.avatar, defaultAvatar(0), await unlockedEmojis(admin, userId));
    const { error } = await admin.from('profiles').upsert({
      user_id: userId,
      name: cleanName(body.name),
      avatar: avatar.emoji,
      avatar_color: avatar.color,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
  await admin
    .from('player_progress')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { data, error } = await admin
    .from('player_progress')
    .select('friend_code')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  if (data.friend_code) return { code: data.friend_code };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const { error: taken } = await admin
      .from('player_progress')
      .update({ friend_code: code })
      .eq('user_id', userId)
      .is('friend_code', null);
    if (taken?.code === '23505') continue;
    if (taken) throw taken;
    const { data: again } = await admin
      .from('player_progress')
      .select('friend_code')
      .eq('user_id', userId)
      .single();
    return { code: again?.friend_code ?? code };
  }
  throw new GameError('Impossible de créer ton code ami, réessaie');
}

async function addFriend(userId: string, body: Record<string, unknown>) {
  const code = cleanFriendCode(body.code);
  const { data: friend, error } = await admin
    .from('player_progress')
    .select('user_id')
    .eq('friend_code', code)
    .maybeSingle();
  if (error) throw error;
  if (!friend) throw new GameError('Aucun joueur avec ce code');
  if (friend.user_id === userId) throw new GameError('C’est ton propre code !');
  const { error: insertError } = await admin.from('friendships').upsert([
    { user_id: userId, friend_id: friend.user_id },
    { user_id: friend.user_id, friend_id: userId },
  ]);
  if (insertError) throw insertError;
  return { ok: true };
}

async function removeFriend(userId: string, body: Record<string, unknown>) {
  const other = String(body.userId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(other)) throw new GameError('Joueur inconnu');
  const { error } = await admin
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${other}),and(user_id.eq.${other},friend_id.eq.${userId})`);
  if (error) throw error;
  return { ok: true };
}

async function podium(userId: string) {
  const { data, error } = await admin.rpc('last_week_board', { p_user: userId });
  if (error) throw error;
  const kind = podiumChest(userId, data ?? []);
  if (!kind) throw new GameError('Pas de podium pour toi la semaine dernière');
  return await rpc('claim_podium', { p_user: userId, p_kind: kind });
}

/** This week's ranking of online games between me and my friends, and last week's podium. */
async function classement(userId: string) {
  const { data: friends, error } = await admin.from('friendships').select('friend_id').eq('user_id', userId);
  if (error) throw error;
  const ids = [userId, ...(friends ?? []).map((f) => f.friend_id as string)];
  const monday = weekStart(parisDay());
  const [profiles, progress, results] = await Promise.all([
    admin.from('profiles').select('user_id, name, avatar, avatar_color').in('user_id', ids),
    admin.from('player_progress').select('user_id, xp, equipped, owned').in('user_id', ids),
    admin
      .from('online_results')
      .select('user_id, game, won, week')
      .in('user_id', ids)
      .in('week', [monday, previousWeek(monday)]),
  ]);
  for (const r of [profiles, progress, results]) if (r.error) throw r.error;
  const people = ids.map((id) => ({
    ...(progress.data ?? []).find((p) => p.user_id === id),
    ...(profiles.data ?? []).find((p) => p.user_id === id),
    user_id: id,
  }));
  return weeklyLeaderboard(userId, people, results.data ?? [], monday, Date.now());
}

/** The public half of the server's notification keys, for the browser to subscribe. */
async function pushKey() {
  return { publicKey: (await vapidKeys(admin)).publicKey };
}

/** Keeps this browser's subscription, so notifications reach it. */
async function pushSubscribe(userId: string, body: Record<string, unknown>) {
  const sub = cleanSubscription(body.subscription, body.lang);
  const { error } = await admin
    .from('push_subscriptions')
    .upsert({ ...sub, user_id: userId, updated_at: new Date().toISOString() });
  if (error) throw error;
  // Old devices beyond the limit are forgotten.
  const { data } = await admin
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  const extra = (data ?? []).slice(MAX_SUBSCRIPTIONS).map((r) => r.endpoint as string);
  if (extra.length > 0) await admin.from('push_subscriptions').delete().in('endpoint', extra);
  return { ok: true };
}

async function pushUnsubscribe(userId: string, body: Record<string, unknown>) {
  const { error } = await admin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', String(body.endpoint ?? ''));
  if (error) throw error;
  return { ok: true };
}

/** My seat at the table with this code: my name there and the table's game. */
async function myTable(userId: string, game: string, code: string) {
  if (game === 'poker') {
    const { data: room } = await admin.from('rooms').select('id').eq('code', code).maybeSingle();
    if (!room) throw new GameError('Aucune table avec ce code');
    const { data: me } = await admin
      .from('room_players')
      .select('name')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!me) throw new GameError('Tu n’es pas à cette table');
    return { name: me.name as string };
  }
  const { data: room } = await admin
    .from('game_rooms')
    .select('id, game, status')
    .eq('code', code)
    .maybeSingle();
  if (!room || room.game !== game) throw new GameError('Aucune table avec ce code');
  if (room.status !== 'lobby') throw new GameError('La partie a déjà commencé');
  const { data: me } = await admin
    .from('game_players')
    .select('name')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!me) throw new GameError('Tu n’es pas à cette table');
  return { name: me.name as string };
}

/** Invites a friend to my table: a notification on their phone and a line in their friends screen. */
async function invite(userId: string, body: Record<string, unknown>) {
  const friendId = String(body.friendId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(friendId)) throw new GameError('Joueur inconnu');
  const game = String(body.game ?? '');
  const code = String(body.code ?? '')
    .trim()
    .toUpperCase();
  if (!/^[a-z0-9]{1,20}$/.test(game) || !/^[A-Z0-9]{4,8}$/.test(code)) {
    throw new GameError('Aucune table avec ce code');
  }
  const { data: friendship } = await admin
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .maybeSingle();
  if (!friendship) throw new GameError('Ce joueur n’est pas dans tes amis');
  const { name } = await myTable(userId, game, code);

  const { data: last } = await admin
    .from('table_invites')
    .select('created_at')
    .eq('from_id', userId)
    .eq('to_id', friendId)
    .eq('room_code', code)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!canInviteAgain(last?.created_at, Date.now())) {
    throw new GameError('Invitation déjà envoyée, patiente une minute');
  }

  const { error } = await admin
    .from('table_invites')
    .insert({ from_id: userId, to_id: friendId, from_name: name, game, room_code: code });
  if (error) throw error;
  // Invitations older than a day are no use any more.
  await admin
    .from('table_invites')
    .delete()
    .eq('to_id', friendId)
    .lt('created_at', new Date(Date.now() - 86_400_000).toISOString());

  let notified = 0;
  try {
    notified = await notify(admin, [friendId], (lang) => inviteNotice(lang, name, game, code), {
      ttl: 1800,
      urgency: 'high',
    });
  } catch (e) {
    console.error('invitation non envoyée', (e as Error).message);
  }
  return { ok: true, notified: notified > 0 };
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
      case 'equip':
        return json(await wear(user.id, body));
      case 'local':
        return json(await local(user.id, body));
      case 'buy':
        return json(await buy(user.id, body));
      case 'claim':
        return json(await claim(user.id, body));
      case 'challenge':
        return json(await claimChallenge(user.id));
      case 'open':
        return json(await openChest(user.id, body));
      case 'achieve':
        return json(await achieve(user.id, body));
      case 'feat':
        return json(await feat(user.id, body));
      case 'unlock':
        return json(await unlock(user.id));
      case 'me':
        return json(await me(user.id, body));
      case 'addFriend':
        return json(await addFriend(user.id, body));
      case 'removeFriend':
        return json(await removeFriend(user.id, body));
      case 'podium':
        return json(await podium(user.id));
      case 'classement':
        return json(await classement(user.id));
      case 'pushKey':
        return json(await pushKey());
      case 'pushSubscribe':
        return json(await pushSubscribe(user.id, body));
      case 'pushUnsubscribe':
        return json(await pushUnsubscribe(user.id, body));
      case 'invite':
        return json(await invite(user.id, body));
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
