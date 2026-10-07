// Profile server: records games played on one phone, changes what a player wears, sells
// shop items and pays finished quests.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { XP_DAILY, parisDay } from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';
import { equip, finishedQuest, localGame, shopItem } from './logic.ts';

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
    .select('xp, equipped, owned, stats_day, day_stats')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { xp: 0, equipped: {}, owned: [], stats_day: null, day_stats: {} };
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
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
