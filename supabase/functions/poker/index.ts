// Game server: the only code allowed to write rooms, deal cards and apply actions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { type HandState, cleanAvatar, defaultAvatar } from '../_shared/engine/index.ts';
import {
  GameError,
  LEVEL_CHOICES,
  MAX_PLAYERS,
  type PlayerRow,
  type RoomRow,
  type SaveParams,
  cleanName,
  dealNextHand,
  firstFreeSeat,
  makeRoomCode,
  parseAction,
  playAction,
  playTimeout,
} from './logic.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function loadRoom(db: SupabaseClient, roomId: string) {
  const { data, error } = await db.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError('Table introuvable');
  return data as RoomRow;
}

async function loadPlayers(db: SupabaseClient, roomId: string) {
  const { data, error } = await db
    .from('room_players')
    .select('user_id, name, seat, stack')
    .eq('room_id', roomId);
  if (error) throw error;
  return data as PlayerRow[];
}

async function loadHand(db: SupabaseClient, roomId: string) {
  const { data, error } = await db
    .from('room_secrets')
    .select('hand_state')
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  return (data?.hand_state ?? null) as HandState | null;
}

async function save(db: SupabaseClient, params: SaveParams) {
  const { data, error } = await db.rpc('save_room_state', params);
  if (error) {
    if (error.message.includes('conflict')) {
      throw new GameError('Quelqu\'un a joué en même temps, réessaie');
    }
    throw error;
  }
  return data as number;
}

function avatarColumns(raw: unknown, seat: number) {
  const avatar = cleanAvatar(raw, defaultAvatar(seat));
  return { avatar: avatar.emoji, avatar_color: avatar.color };
}

async function createRoom(userId: string, body: Record<string, unknown>) {
  const name = cleanName(body.name);
  const bigBlind = Number(body.bigBlind);
  const stack = Number(body.stack);
  if (!Number.isInteger(bigBlind) || bigBlind < 2 || bigBlind % 2 !== 0) {
    throw new GameError('La grosse blinde doit être un nombre pair');
  }
  if (!Number.isInteger(stack) || stack < bigBlind || stack > 1_000_000) {
    throw new GameError('Nombre de jetons invalide');
  }
  const levelMinutes = body.levelMinutes == null ? null : Number(body.levelMinutes);
  if (levelMinutes !== null && !LEVEL_CHOICES.includes(levelMinutes)) {
    throw new GameError('Durée de niveau invalide');
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const { data: room, error } = await admin
      .from('rooms')
      .insert({ code, host_id: userId, big_blind: bigBlind, starting_stack: stack, level_minutes: levelMinutes })
      .select('id, code')
      .single();
    if (error?.code === '23505') continue; // code already used, draw another
    if (error) throw error;
    const { error: seatError } = await admin
      .from('room_players')
      .insert({ room_id: room.id, user_id: userId, name, seat: 0, stack, ...avatarColumns(body.avatar, 0) });
    if (seatError) throw seatError;
    return { roomId: room.id, code: room.code };
  }
  throw new GameError('Impossible de créer la table, réessaie');
}

async function joinRoom(userId: string, body: Record<string, unknown>) {
  const name = cleanName(body.name);
  const code = String(body.code ?? '').trim().toUpperCase();
  const { data: room, error } = await admin
    .from('rooms')
    .select('id, starting_stack')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  if (!room) throw new GameError('Aucune table avec ce code');

  const players = await loadPlayers(admin, room.id);
  if (players.some((p) => p.user_id === userId)) return { roomId: room.id };
  if (players.length >= MAX_PLAYERS) throw new GameError('La table est pleine (8 joueurs maximum)');
  if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new GameError('Ce prénom est déjà pris à cette table');
  }

  const seat = firstFreeSeat(players);
  const { error: insertError } = await admin.from('room_players').insert({
    room_id: room.id,
    user_id: userId,
    name,
    seat,
    stack: room.starting_stack,
    ...avatarColumns(body.avatar, seat),
  });
  if (insertError?.code === '23505') throw new GameError('Ce prénom ou cette place vient d\'être pris, réessaie');
  if (insertError) throw insertError;
  return { roomId: room.id };
}

async function nextHand(userId: string, roomId: string) {
  const room = await loadRoom(admin, roomId);
  if (room.host_id !== userId) throw new GameError('Seul le créateur de la table peut distribuer');
  const [players, previous] = await Promise.all([loadPlayers(admin, roomId), loadHand(admin, roomId)]);
  const version = await save(admin, dealNextHand(room, players, previous, Date.now()));
  return { version };
}

async function act(userId: string, roomId: string, rawAction: unknown) {
  const action = parseAction(rawAction);
  // Read the room before the hand: if a write lands in between, the version check rejects ours.
  const room = await loadRoom(admin, roomId);
  const hand = await loadHand(admin, roomId);
  if (!hand) throw new GameError('Aucune main en cours');
  const version = await save(admin, playAction(room, hand, userId, action, Date.now()));
  return { version };
}

async function timeout(userId: string, roomId: string) {
  const room = await loadRoom(admin, roomId);
  const [players, hand] = await Promise.all([loadPlayers(admin, roomId), loadHand(admin, roomId)]);
  if (!players.some((p) => p.user_id === userId)) throw new GameError('Tu n\'es pas à cette table');
  if (!hand) throw new GameError('Aucune main en cours');
  const version = await save(admin, playTimeout(room, hand, Date.now()));
  return { version };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'Connexion requise' }, 401);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const roomId = String(body.roomId ?? '');
    switch (body.type) {
      case 'create':
        return json(await createRoom(user.id, body));
      case 'join':
        return json(await joinRoom(user.id, body));
      case 'deal':
        return json(await nextHand(user.id, roomId));
      case 'act':
        return json(await act(user.id, roomId, body.action));
      case 'timeout':
        return json(await timeout(user.id, roomId));
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
