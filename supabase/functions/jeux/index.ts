// Server of the online tables for Blackjack, Président, Yams, Belote and Rami: the only code
// allowed to write these tables, deal cards and apply moves.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  WEEKLY_COINS,
  WEEKLY_FEAT,
  WEEKLY_TITLE,
  type WeeklyMatch,
  cleanAvatar,
  defaultAvatar,
  matchKey,
  nextWeeklyFriday,
  ownedKey,
  secureRng,
  weeklyMatchesToOpen,
} from '../_shared/engine/index.ts';
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
  humanActors,
  newGameBot,
  onlineResults,
  playGameMove,
  playGameTimeout,
  progressAwards,
  startGame,
  tournamentResults,
} from './logic.ts';
import { awardXp, unlockedEmojis } from '../_shared/xp.ts';
import { inBackground, notify } from '../_shared/push.ts';
import { newTurns, turnNotice, weeklyMatchNotice, weeklySoonNotice } from '../_shared/notify.ts';
import {
  type WeeklyRegistration,
  type WeeklyRow,
  advanceWeekly,
  championColumns,
  checkRegister,
  checkUnregister,
  hallOfFame,
  matchNotices,
  matchOutcome,
  matchOverdue,
  matchPlayers,
  matchRoom,
  newWeeklyRow,
  playOut,
  playingMatches,
  publicWeekly,
  registrationRow,
  rewardDue,
  startMatch,
  startWeekly,
  weeklyDue,
  weeklyRemindDue,
  withRoom,
} from './weekly.ts';

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
    const { error: seatError } = await admin.from('game_players').insert({
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
  const { error: insertError } = await admin.from('game_players').insert({
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
  const saved = await save(room, snapshot);
  notifyTurns(room, null, snapshot);
  return saved;
}

/** Tells the people who must now play, on their phones, that it is their turn. */
function notifyTurns(room: GameRoomRow, before: GameSecret | null, after: GameSnapshot) {
  const ids = newTurns(before ? humanActors(before) : [], humanActors(after.secret));
  if (ids.length === 0) return;
  inBackground(
    notify(admin, ids, (lang) => turnNotice(lang, room.game, room.code), { ttl: 300, urgency: 'high' }),
  );
}

async function move(userId: string, roomId: string, raw: unknown) {
  // Read the room before the game: if a write lands in between, the version check rejects ours.
  const room = await loadRoom(roomId);
  const secret = await loadSecret(roomId);
  return await saveAndAward(room, secret, playGameMove(secret, userId, raw, secureRng, Date.now()));
}

async function saveAndAward(room: GameRoomRow, before: GameSecret, after: GameSnapshot, weekly = true) {
  const saved = await save(room, after);
  notifyTurns(room, before, after);
  await Promise.all(
    progressAwards(before, after).map((a) => awardXp(admin, a.userId, room.game, a.amount, a.finished)),
  );
  await recordResults(room, before, after);
  const results = room.tournament_id ? tournamentResults(before, after) : null;
  if (results) {
    const { error } = await admin.rpc('tournament_round_done', { p_room: room.id, p_results: results });
    if (error) console.error('tournoi non mis à jour', error);
  }
  // A match of the Friday tournament just ended: the winner moves on, the next tables open.
  if (weekly && room.weekly_id && after.public.over) {
    await syncWeekly(room.weekly_id).catch((e) => console.error('tournoi du vendredi non avancé', e));
  }
  return saved;
}

/** A table just ended: keeps each person's result for the weekly ranking between friends. */
async function recordResults(room: GameRoomRow, before: GameSecret, after: GameSnapshot) {
  const rows = onlineResults(room.id, before, after);
  if (rows.length === 0) return;
  const { error } = await admin.from('online_results').upsert(rows, { ignoreDuplicates: true });
  if (error) console.error('résultats non enregistrés', error);
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

// ---------------------------------------------------------------------------
// The Friday tournament. No timer runs on the server: each request does what is due (see weekly.ts).

async function loadWeekly(id: string) {
  const { data, error } = await admin.from('weekly_tournaments').select('*').eq('id', id).single();
  if (error) throw error;
  return data as WeeklyRow;
}

async function loadRegistrations(id: string) {
  const { data, error } = await admin
    .from('weekly_registrations')
    .select('user_id, name, avatar, avatar_color')
    .eq('tournament_id', id)
    .order('registered_at');
  if (error) throw error;
  return (data ?? []) as WeeklyRegistration[];
}

/** The row of the next Friday, made the first time anyone asks. */
async function upcomingWeekly(now: number) {
  const fresh = newWeeklyRow(now);
  const { error } = await admin
    .from('weekly_tournaments')
    .upsert(fresh, { onConflict: 'friday', ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: readError } = await admin
    .from('weekly_tournaments')
    .select('*')
    .eq('friday', fresh.friday)
    .single();
  if (readError) throw readError;
  return data as WeeklyRow;
}

/** The table of a match: opened once (unique per match), dealt at once. */
async function openMatchRoom(row: WeeklyRow, m: WeeklyMatch, now: number) {
  const key = matchKey(m);
  const existing = async () => {
    const { data } = await admin
      .from('game_rooms')
      .select('*')
      .eq('weekly_id', row.id)
      .eq('weekly_match', key)
      .maybeSingle();
    return data as GameRoomRow | null;
  };
  let room = await existing();
  for (let attempt = 0; !room && attempt < 5; attempt++) {
    const { data, error } = await admin
      .from('game_rooms')
      .insert({ code: makeRoomCode(), ...matchRoom(row.id, row.game, m) })
      .select('*')
      .maybeSingle();
    if (error?.code === '23505') {
      // Either the code was taken, or another request opened this match first.
      room = await existing();
      continue;
    }
    if (error) throw error;
    room = data as GameRoomRow;
    const { error: seatError } = await admin
      .from('game_players')
      .insert(matchPlayers(m).map((p) => ({ ...p, room_id: room!.id })));
    if (seatError) throw seatError;
  }
  if (!room) throw new GameError('Impossible de créer la table, réessaie');
  if (room.status === 'lobby') {
    const { count } = await admin
      .from('game_players')
      .select('user_id', { count: 'exact', head: true })
      .eq('room_id', room.id);
    if (!count) {
      await admin.from('game_players').insert(matchPlayers(m).map((p) => ({ ...p, room_id: room!.id })));
    }
    const snap = startMatch(room, m, secureRng, now);
    // Two requests may deal at once: the version check keeps one.
    await save(room, snap).catch((e) => console.error('table du tournoi non lancée', e));
  }
  return { id: room.id, code: room.code };
}

/** The result of a match's table, if it ended; a table left too long is played out by the server. */
async function matchResult(m: WeeklyMatch, now: number) {
  const { data } = await admin.from('game_secrets').select('state').eq('room_id', m.roomId!).maybeSingle();
  if (!data) return null;
  const secret = data.state as GameSecret;
  const tieBreak = secureRng(2);
  const winner = matchOutcome(secret, m, tieBreak);
  if (winner) return { key: matchKey(m), winner, by: 'game' as const };
  if (!matchOverdue(m, now)) return null;
  const done = playOut(secret, secureRng, now);
  if (!done) return null;
  await saveAndAward(await loadRoom(m.roomId!), secret, done, false);
  const late = matchOutcome(done.secret, m, tieBreak);
  return late ? { key: matchKey(m), winner: late, by: 'timeout' as const } : null;
}

/** Gives the champion their coins, title and trophy (once: the database checks it). */
async function rewardChampion(row: WeeklyRow) {
  if (!rewardDue(row)) return;
  const { error } = await admin.rpc('weekly_reward', {
    p_tournament: row.id,
    p_user: row.winner_id,
    p_coins: WEEKLY_COINS,
    p_title: ownedKey('title', WEEKLY_TITLE),
    p_feat: WEEKLY_FEAT,
  });
  if (error) console.error('récompense du tournoi non donnée', error);
}

/** Saves a new bracket if nobody changed the tournament meanwhile; null when someone did. */
async function saveWeekly(row: WeeklyRow, columns: Record<string, unknown>) {
  const { data, error } = await admin
    .from('weekly_tournaments')
    .update({ ...columns, version: row.version + 1 })
    .eq('id', row.id)
    .eq('version', row.version)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as WeeklyRow | null;
}

/**
 * Does what is due for a tournament: reminder, start, results, next tables, champion.
 * Each step is saved (checked against the version) before the next one, and a table is only
 * opened for a match of a saved bracket: once saved, the two players of a match never change, so
 * two requests running at once can only open the same table for the same players.
 */
async function syncWeekly(id: string, now = Date.now()): Promise<WeeklyRow> {
  for (let attempt = 0; attempt < 6; attempt++) {
    let row = await loadWeekly(id);
    if (weeklyRemindDue(row, now)) {
      const { data: claimed } = await admin
        .from('weekly_tournaments')
        .update({ reminded: true })
        .eq('id', id)
        .eq('reminded', false)
        .select('id')
        .maybeSingle();
      if (claimed) {
        const ids = (await loadRegistrations(id)).map((r) => r.user_id);
        inBackground(
          notify(admin, ids, (lang) => weeklySoonNotice(lang, row.game), { ttl: 600, urgency: 'high' }),
        );
      }
    }
    if (row.status === 'finished') await rewardChampion(row);
    if (row.status !== 'running' && !weeklyDue(row, now)) return row;

    // 1. The start: the bracket is drawn and saved, without tables yet.
    if (row.status === 'open') {
      const start = startWeekly(await loadRegistrations(id), secureRng, () => crypto.randomUUID());
      const saved = await saveWeekly(row, {
        status: start.status,
        bracket: start.bracket,
        players: start.players,
      });
      if (!saved) continue; // someone else started it meanwhile
      if (saved.status !== 'running') return saved;
      row = saved;
    }
    if (!row.bracket) return row;

    // 2. Results of the tables: winners move on, robots meet by a draw, maybe a champion.
    const results = [];
    for (const m of playingMatches(row.bracket)) {
      try {
        const r = await matchResult(m, now);
        if (r) results.push(r);
      } catch (e) {
        console.error('match du tournoi non lu', e);
      }
    }
    const step = advanceWeekly(row.bracket, results, secureRng);
    const moved = JSON.stringify(step.bracket) !== JSON.stringify(row.bracket);
    if (moved || step.champion) {
      const saved = await saveWeekly(row, {
        bracket: step.bracket,
        ...(step.champion ? championColumns(step.champion, now) : {}),
      });
      if (!saved) continue; // someone else moved the bracket meanwhile: start again from theirs
      row = saved;
    }
    if (row.status === 'finished') {
      await rewardChampion(row);
      return row;
    }

    // 3. The tables of the matches whose two players are now known.
    const toOpen = weeklyMatchesToOpen(row.bracket!);
    if (toOpen.length === 0) return row;
    let next = row.bracket!;
    for (const m of toOpen) next = withRoom(next, matchKey(m), await openMatchRoom(row, m, now), now);
    const saved = await saveWeekly(row, { bracket: next });
    if (!saved) continue; // the tables stay, and are found again from the saved bracket
    for (const n of matchNotices(row.bracket, next)) {
      inBackground(
        notify(
          admin,
          [n.userId],
          (lang) => weeklyMatchNotice(lang, row.game, n.code, n.opponent, n.round === 0),
          {
            ttl: 900,
            urgency: 'high',
          },
        ),
      );
    }
    return saved;
  }
  return await loadWeekly(id);
}

/** The Friday tournament: the next one, the one being played (or just played), past champions. */
async function weekly(userId: string) {
  const now = Date.now();
  await upcomingWeekly(now);
  // Tournaments that start within 15 minutes or are being played: send what is due.
  const { data: active, error } = await admin
    .from('weekly_tournaments')
    .select('id')
    .in('status', ['open', 'running'])
    .lte('starts_at', new Date(now + 15 * 60_000).toISOString());
  if (error) throw error;
  for (const t of active ?? []) {
    try {
      await syncWeekly(t.id as string, now);
    } catch (e) {
      console.error('tournoi du vendredi non synchronisé', e);
    }
  }
  const [next, current, past] = await Promise.all([
    admin.from('weekly_tournaments').select('*').eq('friday', nextWeeklyFriday(now)).single(),
    admin
      .from('weekly_tournaments')
      .select('*')
      .lte('starts_at', new Date(now).toISOString())
      .order('friday', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('weekly_tournaments')
      .select(
        'friday, game, status, winner_id, winner_name, winner_avatar, winner_avatar_color, winner_bot, players',
      )
      .eq('status', 'finished')
      .order('friday', { ascending: false })
      .limit(200),
  ]);
  for (const r of [next, current, past]) if (r.error) throw r.error;
  const upcoming = next.data as WeeklyRow;
  const playing = current.data as WeeklyRow | null;
  // The one being played, or the last one for a day after it started.
  const shown =
    playing && (playing.status === 'running' || now - Date.parse(playing.starts_at) < 30 * 3_600_000)
      ? playing
      : null;
  const [upcomingRegs, shownRegs] = await Promise.all([
    loadRegistrations(upcoming.id),
    shown ? loadRegistrations(shown.id) : Promise.resolve([]),
  ]);
  const pastRows = (past.data ?? []) as WeeklyRow[];
  return {
    now,
    upcoming: publicWeekly(upcoming, upcomingRegs, userId),
    current: shown ? publicWeekly(shown, shownRegs, userId) : null,
    past: pastRows.slice(0, 12).map((r) => ({
      friday: r.friday,
      game: r.game,
      players: r.players,
      winner: {
        id: r.winner_id,
        name: r.winner_name ?? 'Joueur',
        avatar: r.winner_avatar,
        avatar_color: r.winner_avatar_color,
        bot: !!r.winner_bot,
      },
    })),
    hall: hallOfFame(pastRows).slice(0, 10),
  };
}

async function weeklyRegister(userId: string, body: Record<string, unknown>) {
  const now = Date.now();
  const row = await upcomingWeekly(now);
  const regs = await loadRegistrations(row.id);
  checkRegister(
    row,
    regs.length,
    regs.some((r) => r.user_id === userId),
    now,
  );
  const { error } = await admin
    .from('weekly_registrations')
    .upsert(registrationRow(row.id, userId, body, await unlockedEmojis(admin, userId)));
  if (error) throw error;
  return await weekly(userId);
}

async function weeklyUnregister(userId: string) {
  const now = Date.now();
  const row = await upcomingWeekly(now);
  checkUnregister(row, now);
  const { error } = await admin
    .from('weekly_registrations')
    .delete()
    .eq('tournament_id', row.id)
    .eq('user_id', userId);
  if (error) throw error;
  return await weekly(userId);
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
      case 'weekly':
        return json(await weekly(user.id));
      case 'weeklyRegister':
        return json(await weeklyRegister(user.id, body));
      case 'weeklyUnregister':
        return json(await weeklyUnregister(user.id));
      default:
        return json({ error: 'Requête inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Erreur du serveur' }, 500);
  }
});
