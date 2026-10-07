// Server of the online tables for Blackjack, Président, Yams and Belote: the only code
// allowed to write these tables, deal cards and apply moves.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cleanAvatar, defaultAvatar, secureRng } from '../_shared/engine/index.ts';
import { GameError, cleanName, makeRoomCode } from '../poker/logic.ts';
import {
  type GamePlayerRow,
  type GameRoomRow,
  type GameSecret,
  type GameSnapshot,
  checkJoin,
  cleanOptions,
  firstFreeGameSeat,
  gameDef,
  newGameBot,
  playGameMove,
  playGameTimeout,
  progressAwards,
  startGame,
} from './logic.ts';
import { awardXp, unlockedEmojis } from '../_shared/xp.ts';

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

async function loadRoom(roomId: string) {
  const { data, error } = await admin.from('game_rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError('Table introuvable');
  return data as GameRoomRow;
}

async function loadPlayers(roomId: string) {
  const { data, error } = await admin
    .from('game_players')
    .select('user_id, name, seat, is_bot')
    .eq('room_id', roomId);
  if (error) throw error;
  return data as GamePlayerRow[];
}

async function loadSecret(roomId: string) {
  const { data, error } = await admin.from('game_secrets').select('state').eq('room_id', roomId).maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError('La partie n’a pas commencé');
  return data.state as GameSecret;
}

async function save(room: GameRoomRow, snap: GameSnapshot) {
  const { data, error } = await admin.rpc('save_game_state', {
    p_room: room.id,
    p_version: room.version,
    p_public: snap.public,
    p_secret: snap.secret,
    p_private: snap.privates,
  });
  if (error) {
    if (error.message.includes('conflict')) throw new GameError('Quelqu’un a joué en même temps, réessaie');
    throw error;
  }
  return { version: data as number };
}

function avatarColumns(raw: unknown, seat: number, extra: string[]) {
  const avatar = cleanAvatar(raw, defaultAvatar(seat), extra);
  return { avatar: avatar.emoji, avatar_color: avatar.color };
}

async function createRoom(userId: string, body: Record<string, unknown>) {
  const name = cleanName(body.name);
  const options = cleanOptions(body.game, body.options);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: room, error } = await admin
      .from('game_rooms')
      .insert({ code: makeRoomCode(), game: body.game, host_id: userId, options })
      .select('id, code')
      .single();
    if (error?.code === '23505') continue; // code already used, draw another
    if (error) throw error;
    const { error: seatError } = await admin
      .from('game_players')
      .insert({ room_id: room.id, user_id: userId, name, seat: 0, ...avatarColumns(body.avatar, 0, await unlockedEmojis(admin, userId)) });
    if (seatError) throw seatError;
    return { roomId: room.id, code: room.code };
  }
  throw new GameError('Impossible de créer la table, réessaie');
}

async function joinRoom(userId: string, body: Record<string, unknown>) {
  const name = cleanName(body.name);
  const code = String(body.code ?? '').trim().toUpperCase();
  const { data: room, error } = await admin.from('game_rooms').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!room) throw new GameError('Aucune table avec ce code');
  if (body.game && body.game !== room.game) {
    throw new GameError('Ce code est celui d’une table d’un autre jeu');
  }
  const players = await loadPlayers(room.id);
  if (players.some((p) => p.user_id === userId)) return { roomId: room.id, game: room.game };
  checkJoin(room as GameRoomRow, players, userId, name);
  const seat = firstFreeGameSeat(players);
  const { error: insertError } = await admin
    .from('game_players')
    .insert({ room_id: room.id, user_id: userId, name, seat, ...avatarColumns(body.avatar, seat, await unlockedEmojis(admin, userId)) });
  if (insertError?.code === '23505') throw new GameError('Cette place vient d’être prise, réessaie');
  if (insertError) throw insertError;
  return { roomId: room.id, game: room.game };
}

async function addBot(userId: string, roomId: string) {
  const room = await loadRoom(roomId);
  const bot = newGameBot(room, await loadPlayers(roomId), userId, crypto.randomUUID());
  const { error } = await admin.from('game_players').insert(bot);
  if (error?.code === '23505') throw new GameError('Cette place vient d’être prise, réessaie');
  if (error) throw error;
  return { ok: true };
}

/** Before the start: the host removes someone, or a player leaves. */
async function removePlayer(userId: string, roomId: string, targetId: string) {
  const room = await loadRoom(roomId);
  if (room.status !== 'lobby') throw new GameError('La partie a déjà commencé');
  if (targetId !== userId && room.host_id !== userId) {
    throw new GameError('Seul le créateur de la table peut retirer un joueur');
  }
  if (targetId === room.host_id) throw new GameError('Le créateur ne peut pas quitter sa table');
  const { error } = await admin.from('game_players').delete().eq('room_id', roomId).eq('user_id', targetId);
  if (error) throw error;
  return { ok: true };
}

async function start(userId: string, roomId: string) {
  const room = await loadRoom(roomId);
  const { bots, snapshot } = startGame(
    room,
    await loadPlayers(roomId),
    userId,
    () => crypto.randomUUID(),
    secureRng,
    Date.now(),
  );
  if (bots.length > 0) {
    const { error } = await admin.from('game_players').insert(bots);
    if (error) throw error;
  }
  return await save(room, snapshot);
}

async function move(userId: string, roomId: string, raw: unknown) {
  // Read the room before the game: if a write lands in between, the version check rejects ours.
  const room = await loadRoom(roomId);
  const secret = await loadSecret(roomId);
  return await saveAndAward(room, secret, playGameMove(secret, userId, raw, secureRng, Date.now()));
}

async function saveAndAward(room: GameRoomRow, before: GameSecret, after: GameSnapshot) {
  const saved = await save(room, after);
  await Promise.all(
    progressAwards(before, after).map((a) => awardXp(admin, a.userId, room.game, a.amount, a.finished)),
  );
  return saved;
}

async function tick(userId: string, roomId: string) {
  const room = await loadRoom(roomId);
  const secret = await loadSecret(roomId);
  if (!secret.seats.some((s) => s.id === userId)) throw new GameError('Tu n’es pas à cette table');
  return await saveAndAward(room, secret, playGameTimeout(secret, secureRng, Date.now()));
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
        gameDef(body.game);
        return json(await createRoom(user.id, body));
      case 'join':
        return json(await joinRoom(user.id, body));
      case 'addBot':
        return json(await addBot(user.id, roomId));
      case 'remove':
        return json(await removePlayer(user.id, roomId, String(body.userId ?? '')));
      case 'start':
        return json(await start(user.id, roomId));
      case 'move':
        return json(await move(user.id, roomId, body.move));
      case 'tick':
        return json(await tick(user.id, roomId));
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
