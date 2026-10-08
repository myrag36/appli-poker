// Game server: the only code allowed to write rooms, deal cards and apply actions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  type HandState,
  XP_PLAY,
  XP_POKER_HAND,
  XP_POKER_POT,
  XP_WIN,
  cleanAvatar,
  defaultAvatar,
} from '../_shared/engine/index.ts';
import {
  GameError,
  LEVEL_CHOICES,
  VARIANTS,
  MAX_PLAYERS,
  type PlayerRow,
  type Rematch,
  type RoomRow,
  type SaveParams,
  type SeatedPlayerRow,
  checkRemoval,
  cleanName,
  dealNextHand,
  firstFreeSeat,
  handRecords,
  makeRoomCode,
  newBot,
  parseAction,
  pausedState,
  playAction,
  playTimeout,
  pokerRematch,
  pokerRematchJoin,
} from './logic.ts';
import { awardXp, unlockedEmojis } from '../_shared/xp.ts';
import { inBackground, notify } from '../_shared/push.ts';
import { newTurns, pokerToAct, turnNotice } from '../_shared/notify.ts';

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

async function loadRoom(db: SupabaseClient, roomId: string) {
  const { data, error } = await db.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError('Table introuvable');
  return data as RoomRow;
}

async function loadPlayers(db: SupabaseClient, roomId: string) {
  const { data, error } = await db
    .from('room_players')
    .select('user_id, name, seat, stack, is_bot')
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
      throw new GameError("Quelqu'un a joué en même temps, réessaie");
    }
    throw error;
  }
  return data as number;
}

function avatarColumns(raw: unknown, seat: number, extra: string[]) {
  const avatar = cleanAvatar(raw, defaultAvatar(seat), extra);
  return { avatar: avatar.emoji, avatar_color: avatar.color };
}

/** Remembers the name and avatar a player last used, for the rankings. */
async function saveProfile(userId: string, name: string, avatar: { avatar: string; avatar_color: string }) {
  const { error } = await admin
    .from('profiles')
    .upsert({ user_id: userId, name, ...avatar, updated_at: new Date().toISOString() });
  if (error) console.error('profil non enregistré', error);
}

/**
 * Once a hand is over, keeps it for the history and the statistics. A failure here
 * is logged but never undoes the move that was just played.
 */
async function recordHand(room: RoomRow, saved: SaveParams) {
  if (saved.p_public.street !== 'finished') return;
  try {
    const records = handRecords(room, await loadPlayers(admin, room.id), saved);
    if (!records) return;
    const [history, results, game] = await Promise.all([
      admin.from('hand_history').upsert(records.history, { ignoreDuplicates: true }),
      // Only rows written now come back, so a hand recorded twice gives experience once.
      admin.from('hand_results').upsert(records.results, { ignoreDuplicates: true }).select('user_id, won'),
      records.game
        ? admin.from('game_results').upsert(records.game, { ignoreDuplicates: true }).select('winner_id')
        : null,
    ]);
    for (const r of [history, results, game]) if (r?.error) throw r.error;
    const awards = (results.data ?? []).map((r) =>
      awardXp(admin, r.user_id, 'poker', XP_POKER_HAND + (r.won ? XP_POKER_POT : 0), null),
    );
    // The game is over: everyone who played it gets the end-of-game experience.
    if (game?.data?.length) {
      for (const p of await loadPlayers(admin, room.id)) {
        if (p.is_bot) continue;
        const won = p.user_id === records.game!.winner_id;
        awards.push(awardXp(admin, p.user_id, 'poker', XP_PLAY + (won ? XP_WIN : 0), { won }));
      }
    }
    await Promise.all(awards);
  } catch (e) {
    console.error('main non enregistrée', e);
  }
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
  const variant = body.variant ?? 'holdem';
  if (!VARIANTS.includes(variant as never)) throw new GameError('Variante inconnue');

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const { data: room, error } = await admin
      .from('rooms')
      .insert({
        code,
        host_id: userId,
        big_blind: bigBlind,
        starting_stack: stack,
        level_minutes: levelMinutes,
        variant,
      })
      .select('id, code')
      .single();
    if (error?.code === '23505') continue; // code already used, draw another
    if (error) throw error;
    const avatar = avatarColumns(body.avatar, 0, await unlockedEmojis(admin, userId));
    const { error: seatError } = await admin
      .from('room_players')
      .insert({ room_id: room.id, user_id: userId, name, seat: 0, stack, ...avatar });
    if (seatError) throw seatError;
    await saveProfile(userId, name, avatar);
    return { roomId: room.id, code: room.code };
  }
  throw new GameError('Impossible de créer la table, réessaie');
}

async function joinRoom(userId: string, body: Record<string, unknown>) {
  const name = cleanName(body.name);
  const code = String(body.code ?? '')
    .trim()
    .toUpperCase();
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
  const avatar = avatarColumns(body.avatar, seat, await unlockedEmojis(admin, userId));
  const { error: insertError } = await admin.from('room_players').insert({
    room_id: room.id,
    user_id: userId,
    name,
    seat,
    stack: room.starting_stack,
    ...avatar,
  });
  if (insertError?.code === '23505')
    throw new GameError("Ce prénom ou cette place vient d'être pris, réessaie");
  if (insertError) throw insertError;
  await saveProfile(userId, name, avatar);
  // Someone who was watching now plays.
  await admin.from('room_spectators').delete().eq('room_id', room.id).eq('user_id', userId);
  return { roomId: room.id };
}

async function watchRoom(userId: string, body: Record<string, unknown>) {
  const name = cleanName(body.name);
  const code = String(body.code ?? '')
    .trim()
    .toUpperCase();
  const { data: room, error } = await admin.from('rooms').select('id').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!room) throw new GameError('Aucune table avec ce code');
  const players = await loadPlayers(admin, room.id);
  // A player keeps their seat; anyone else watches.
  if (!players.some((p) => p.user_id === userId)) {
    const { error: watchError } = await admin
      .from('room_spectators')
      .upsert({ room_id: room.id, user_id: userId, name });
    if (watchError) throw watchError;
  }
  return { roomId: room.id };
}

/** Tells the player who must now act, on their phone, that it is their turn. */
function notifyTurn(room: RoomRow, before: HandState | null, saved: SaveParams) {
  const ids = newTurns(pokerToAct(before), pokerToAct(saved.p_secret), saved.p_public.bots ?? []);
  if (ids.length === 0 || !room.code) return;
  const code = room.code;
  inBackground(notify(admin, ids, (lang) => turnNotice(lang, 'poker', code), { ttl: 300, urgency: 'high' }));
}

async function nextHand(userId: string, roomId: string) {
  const room = await loadRoom(admin, roomId);
  if (room.host_id !== userId) throw new GameError('Seul le créateur de la table peut distribuer');
  const [players, previous] = await Promise.all([loadPlayers(admin, roomId), loadHand(admin, roomId)]);
  const saved = dealNextHand(room, players, previous, Date.now());
  const version = await save(admin, saved);
  notifyTurn(room, null, saved);
  // With only all-in players left, a hand can be over as soon as it is dealt.
  await recordHand(room, saved);
  return { version };
}

async function act(userId: string, roomId: string, rawAction: unknown) {
  const action = parseAction(rawAction);
  // Read the room before the hand: if a write lands in between, the version check rejects ours.
  const room = await loadRoom(admin, roomId);
  const hand = await loadHand(admin, roomId);
  if (!hand) throw new GameError('Aucune main en cours');
  const saved = playAction(room, hand, userId, action, Date.now());
  const version = await save(admin, saved);
  notifyTurn(room, hand, saved);
  await recordHand(room, saved);
  return { version };
}

async function timeout(userId: string, roomId: string) {
  const room = await loadRoom(admin, roomId);
  const [players, hand] = await Promise.all([loadPlayers(admin, roomId), loadHand(admin, roomId)]);
  if (!players.some((p) => p.user_id === userId)) throw new GameError("Tu n'es pas à cette table");
  if (!hand) throw new GameError('Aucune main en cours');
  const saved = playTimeout(room, hand, Date.now());
  const version = await save(admin, saved);
  notifyTurn(room, hand, saved);
  await recordHand(room, saved);
  return { version };
}

async function setPaused(userId: string, roomId: string, paused: boolean) {
  const room = await loadRoom(admin, roomId);
  if (room.host_id !== userId) throw new GameError('Seul le créateur de la table peut mettre en pause');
  if (Boolean(room.paused) === paused) return { version: room.version };
  const { data, error } = await admin
    .from('rooms')
    .update({ paused, public_state: pausedState(room, paused, Date.now()), version: room.version + 1 })
    .eq('id', roomId)
    .eq('version', room.version)
    .select('version')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError("Quelqu'un a joué en même temps, réessaie");
  return { version: data.version };
}

async function addBot(userId: string, roomId: string) {
  const room = await loadRoom(admin, roomId);
  const bot = newBot(room, await loadPlayers(admin, roomId), userId, crypto.randomUUID());
  const { error } = await admin.from('room_players').insert(bot);
  if (error?.code === '23505') throw new GameError("Cette place vient d'être prise, réessaie");
  if (error) throw error;
  return { ok: true };
}

async function removePlayer(userId: string, roomId: string, targetId: string) {
  const room = await loadRoom(admin, roomId);
  checkRemoval(room, await loadPlayers(admin, roomId), userId, targetId);
  const { error } = await admin.from('room_players').delete().eq('room_id', roomId).eq('user_id', targetId);
  if (error) throw error;
  await admin.from('private_hands').delete().eq('room_id', roomId).eq('user_id', targetId);
  return { ok: true };
}

async function loadSeated(roomId: string) {
  const { data, error } = await admin
    .from('room_players')
    .select('user_id, name, seat, stack, is_bot, avatar, avatar_color')
    .eq('room_id', roomId);
  if (error) throw error;
  return data as SeatedPlayerRow[];
}

/**
 * Revanche: the first player to ask opens a new table with the same settings and writes it
 * on the finished one; everyone who asks after that is seated there directly.
 */
async function rematch(userId: string, roomId: string) {
  const room = await loadRoom(admin, roomId);
  const players = await loadSeated(roomId);
  let target = room.rematch ?? null;
  if (!target) {
    const plan = pokerRematch(room, players, userId);
    const created = await insertRematchRoom(plan.room);
    const { error: seatError } = await admin
      .from('room_players')
      .insert(plan.players.map((p) => ({ ...p, room_id: created.id })));
    if (seatError) throw seatError;
    const me = players.find((p) => p.user_id === userId)!;
    const mine: Rematch = { roomId: created.id, code: created.code, byId: userId, by: me.name };
    // Only one rematch per game: if someone else was faster, drop ours and follow theirs.
    const { data: claimed, error } = await admin
      .from('rooms')
      .update({ rematch: mine })
      .eq('id', roomId)
      .is('rematch', null)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (claimed) return { roomId: created.id };
    await admin.from('rooms').delete().eq('id', created.id);
    target = (await loadRoom(admin, roomId)).rematch ?? null;
    if (!target) throw new GameError("Quelqu'un a joué en même temps, réessaie");
  }
  const next = await loadRoom(admin, target.roomId).catch(() => {
    throw new GameError('Cette revanche n’existe plus');
  });
  const row = pokerRematchJoin(next, await loadPlayers(admin, next.id), players, userId);
  if (row) {
    const { error } = await admin.from('room_players').insert(row);
    if (error?.code === '23505') throw new GameError("Cette place vient d'être prise, réessaie");
    if (error) throw error;
  }
  return { roomId: next.id };
}

async function insertRematchRoom(settings: ReturnType<typeof pokerRematch>['room']) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from('rooms')
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
        return json(await createRoom(user.id, body));
      case 'join':
        return json(await joinRoom(user.id, body));
      case 'watch':
        return json(await watchRoom(user.id, body));
      case 'deal':
        return json(await nextHand(user.id, roomId));
      case 'act':
        return json(await act(user.id, roomId, body.action));
      case 'timeout':
        return json(await timeout(user.id, roomId));
      case 'pause':
        return json(await setPaused(user.id, roomId, body.paused === true));
      case 'addBot':
        return json(await addBot(user.id, roomId));
      case 'remove':
        return json(await removePlayer(user.id, roomId, String(body.userId ?? '')));
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
