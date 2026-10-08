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
} from '../_shared/engine/index.ts';
import { GameError, cleanName, makeRoomCode } from '../poker/logic.ts';
import { levelChests, unlockedEmojis } from '../_shared/xp.ts';
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
  shopItem,
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
    .select('xp, equipped, owned, stats_day, day_stats, games, best_streak, quests_done, feats')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { xp: 0, equipped: {}, owned: [], stats_day: null, day_stats: {}, games: {}, best_streak: 0, quests_done: 0, feats: [] };
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
  const { data, error } = await admin.from('player_progress').select('chests, owned').eq('user_id', userId).maybeSingle();
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
  await admin.from('player_progress').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { data, error } = await admin.from('player_progress').select('friend_code').eq('user_id', userId).single();
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
    const { data: again } = await admin.from('player_progress').select('friend_code').eq('user_id', userId).single();
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
      case 'me':
        return json(await me(user.id, body));
      case 'addFriend':
        return json(await addFriend(user.id, body));
      case 'removeFriend':
        return json(await removeFriend(user.id, body));
      case 'podium':
        return json(await podium(user.id));
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
