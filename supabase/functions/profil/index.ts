// Profile server: records games played on one phone and changes what a player wears.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { XP_DAILY } from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';
import { equip, localGame } from './logic.ts';

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
    .select('xp, equipped')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { xp: 0, equipped: {} };
}

async function wear(userId: string, body: Record<string, unknown>) {
  const progress = await loadProgress(userId);
  const equipped = equip(progress.xp, progress.equipped, body.slot, body.id);
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
  });
  if (error) throw error;
  return data;
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
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
