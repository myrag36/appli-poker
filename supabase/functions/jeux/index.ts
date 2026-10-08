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
  type Rematch,
  type SeatedGamePlayerRow,
  checkJoin,
  gameRematch,
  gameRematchJoin,
  cleanOptions,
  cleanTournamentGames,
  cleanTournamentName,
  firstFreeGameSeat,
  gameDef,
  newGameBot,
  playGameMove,
  playGameTimeout,
  progressAwards,
  startGame,
  tournamentResults,
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
  const { data, error } = await admin
    .from('game_secrets')
    .select('state')
    .eq('room_id', roomId)
    .maybeSingle();
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
  const tournament = body.tournamentId
    ? await tournamentTable(userId, String(body.tournamentId), body.game)
    : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: room, error } = await admin
      .from('game_rooms')
      .insert({
        code: makeRoomCode(),
        game: body.game,
        host_id: userId,
        options,
        ...(tournament ? { tournament_id: tournament.id, tournament_round: tournament.round } : {}),
      })
      .select('id, code')
      .single();
    if (error?.code === '23505') continue; // code already used, draw another
    if (error) throw error;
    const { error: seatError } = await admin
      .from('game_players')
      .insert({
        room_id: room.id,
        user_id: userId,
        name,
        seat: 0,
        ...avatarColumns(body.avatar, 0, await unlockedEmojis(admin, userId)),
      });
    if (seatError) throw seatError;
    if (tournament) {
      const { error: linkError } = await admin
        .from('tournaments')
        .update({ status: 'playing', room_id: room.id, room_code: room.code })
        .eq('id', tournament.id);
      if (linkError) throw linkError;
    }
    return { roomId: room.id, code: room.code };
  }
  throw new GameError('Impossible de créer la table, réessaie');
}

/** The tournament whose next table the host is opening, checked. */
async function tournamentTable(userId: string, tournamentId: string, game: unknown) {
  const { data: t, error } = await admin.from('tournaments').select('*').eq('id', tournamentId).maybeSingle();
  if (error) throw error;
  if (!t) throw new GameError('Tournoi introuvable');
  if (t.host_id !== userId) throw new GameError('Seul l’organisateur lance les parties');
  if (t.status === 'finished') throw new GameError('Ce tournoi est terminé');
  if (t.games[t.round] !== game) throw new GameError('Ce n’est pas le jeu prévu pour cette manche');
  return t as { id: string; round: number };
}

async function tournamentPlayer(userId: string, tournamentId: string, body: Record<string, unknown>) {
  const avatar = cleanAvatar(body.avatar, defaultAvatar(0), await unlockedEmojis(admin, userId));
  const { error } = await admin.from('tournament_players').upsert({
    tournament_id: tournamentId,
    user_id: userId,
    name: cleanName(body.name),
    avatar: avatar.emoji,
    avatar_color: avatar.color,
  });
  if (error) throw error;
}

async function createTournament(userId: string, body: Record<string, unknown>) {
  const games = cleanTournamentGames(body.games);
  const name = cleanTournamentName(body.title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from('tournaments')
      .insert({ code: makeRoomCode(), name, host_id: userId, games })
      .select('id, code')
      .single();
    if (error?.code === '23505') continue;
    if (error) throw error;
    await tournamentPlayer(userId, data.id, body);
    return { tournamentId: data.id, code: data.code };
  }
  throw new GameError('Impossible de créer le tournoi, réessaie');
}

async function joinTournament(userId: string, body: Record<string, unknown>) {
  const code = String(body.code ?? '')
    .trim()
    .toUpperCase();
  const { data: t, error } = await admin
    .from('tournaments')
    .select('id, status')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  if (!t) throw new GameError('Aucun tournoi avec ce code');
  const { count } = await admin
    .from('tournament_players')
    .select('user_id', { count: 'exact', head: true })
    .eq('tournament_id', t.id);
  const { data: already } = await admin
    .from('tournament_players')
    .select('user_id')
    .eq('tournament_id', t.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!already) {
    if (t.status === 'finished') throw new GameError('Ce tournoi est terminé');
    if ((count ?? 0) >= 8) throw new GameError('Ce tournoi est complet');
  }
  await tournamentPlayer(userId, t.id, body);
  return { tournamentId: t.id };
}

async function joinRoom(userId: string, body: Record<string, unknown>) {
  const name = cleanName(body.name);
  const code = String(body.code ?? '')
    .trim()
    .toUpperCase();
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
    .insert({
      room_id: room.id,
      user_id: userId,
      name,
      seat,
      ...avatarColumns(body.avatar, seat, await unlockedEmojis(admin, userId)),
    });
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
  const results = room.tournament_id ? tournamentResults(before, after) : null;
  if (results) {
    const { error } = await admin.rpc('tournament_round_done', { p_room: room.id, p_results: results });
    if (error) console.error('tournoi non mis à jour', error);
  }
  return saved;
}

async function tick(userId: string, roomId: string) {
  const room = await loadRoom(roomId);
  const secret = await loadSecret(roomId);
  if (!secret.seats.some((s) => s.id === userId)) throw new GameError('Tu n’es pas à cette table');
  return await saveAndAward(room, secret, playGameTimeout(secret, secureRng, Date.now()));
}

/**
 * Revanche: the first player to ask opens a new table for the same game and writes it on
 * the finished one; everyone who asks after that is seated there directly.
 */
async function rematch(userId: string, roomId: string) {
  const room = await loadRoom(roomId);
  const { data, error: playersError } = await admin
    .from('game_players')
    .select('user_id, name, seat, is_bot, avatar, avatar_color')
    .eq('room_id', roomId);
  if (playersError) throw playersError;
  const players = data as SeatedGamePlayerRow[];
  let target = room.rematch ?? null;
  if (!target) {
    const plan = gameRematch(room, await loadSecret(roomId), players, userId);
    const created = await insertRematchRoom(plan.room);
    const { error: seatError } = await admin
      .from('game_players')
      .insert(plan.players.map((p) => ({ ...p, room_id: created.id })));
    if (seatError) throw seatError;
    const me = players.find((p) => p.user_id === userId)!;
    const mine: Rematch = { roomId: created.id, code: created.code, byId: userId, by: me.name };
    // Only one rematch per game: if someone else was faster, drop ours and follow theirs.
    const { data: claimed, error } = await admin
      .from('game_rooms')
      .update({ rematch: mine })
      .eq('id', roomId)
      .is('rematch', null)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (claimed) return { roomId: created.id };
    await admin.from('game_rooms').delete().eq('id', created.id);
    target = (await loadRoom(roomId)).rematch ?? null;
    if (!target) throw new GameError('Quelqu’un a joué en même temps, réessaie');
  }
  const next = await loadRoom(target.roomId).catch(() => {
    throw new GameError('Cette revanche n’existe plus');
  });
  const row = gameRematchJoin(next, await loadPlayers(next.id), players, userId);
  if (row) {
    const { error } = await admin.from('game_players').insert(row);
    if (error?.code === '23505') throw new GameError('Cette place vient d’être prise, réessaie');
    if (error) throw error;
  }
  return { roomId: next.id };
}

async function insertRematchRoom(settings: ReturnType<typeof gameRematch>['room']) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from('game_rooms')
      .insert({ code: makeRoomCode(), ...settings })
      .select('id, code')
      .single();
    if (error?.code === '23505') continue;
    if (error) throw error;
    return data as { id: string; code: string };
  }
  throw new GameError('Impossible de créer la table, réessaie');
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
      case 'tournamentCreate':
        return json(await createTournament(user.id, body));
      case 'tournamentJoin':
        return json(await joinTournament(user.id, body));
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
      case 'rematch':
        return json(await rematch(user.id, roomId));
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
