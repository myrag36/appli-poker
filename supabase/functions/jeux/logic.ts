// Rules of the online tables for Blackjack, Président, Yams and Belote, without any database
// access so they can be tested on their own. The games themselves live in the engine.
import {
  ONLINE_BOT_NAMES,
  ONLINE_GAMES,
  type OnlineGame,
  type OnlineGameId,
  type OnlineSeat,
  type Rng,
  XP_PLAY,
  XP_ROUND,
  XP_WIN,
  isOnlineGame,
} from '../_shared/engine/index.ts';
import { GameError } from '../poker/logic.ts';

/** How long a person has to play before the server plays for them. */
export const TURN_MS = 60_000;
/** Pause before a robot plays, so people can follow. */
export const BOT_MS = 1_200;
/** Pause between two rounds before the next one starts on its own. */
export const NEXT_MS = 15_000;

export interface GameRoomRow {
  id: string;
  code: string;
  game: OnlineGameId;
  host_id: string;
  options: Record<string, unknown>;
  status: 'lobby' | 'playing';
  version: number;
  tournament_id?: string | null;
}

export interface GamePlayerRow {
  user_id: string;
  name: string;
  seat: number;
  is_bot: boolean;
}

/** Everything the server keeps about a game in progress. */
export interface GameSecret {
  game: OnlineGameId;
  seats: OnlineSeat[];
  state: unknown;
  /** When the current wait ends (epoch ms): a turn, a robot's pause or the pause between rounds. */
  deadline: number | null;
}

/** What every player at the table receives. */
export interface GamePublic {
  game: OnlineGameId;
  seats: OnlineSeat[];
  /** Ids of the players who may move now. */
  actors: string[];
  deadline: number | null;
  betweenRounds: boolean;
  over: boolean;
  view: unknown;
}

export interface GameSnapshot {
  public: GamePublic;
  secret: GameSecret;
  /** Each person's own view, by user id. */
  privates: Record<string, unknown>;
}

export function gameDef(game: unknown): OnlineGame {
  if (!isOnlineGame(game)) throw new GameError('Jeu inconnu');
  return ONLINE_GAMES[game];
}

/** Runs a game rule and turns its refusal into a message for the player. */
function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof GameError) throw e;
    throw new GameError(e instanceof Error ? e.message : 'Coup refusé');
  }
}

export function cleanOptions(game: unknown, raw: unknown): Record<string, unknown> {
  const def = gameDef(game);
  return rule(() => def.options(raw ?? {}));
}

export function firstFreeGameSeat(players: GamePlayerRow[]): number {
  const taken = new Set(players.map((p) => p.seat));
  for (let s = 0; s < 8; s++) if (!taken.has(s)) return s;
  throw new GameError('La table est pleine');
}

export function checkJoin(room: GameRoomRow, players: GamePlayerRow[], userId: string, name: string) {
  if (room.status !== 'lobby') throw new GameError('La partie a déjà commencé');
  if (players.length >= gameDef(room.game).maxPlayers) throw new GameError('La table est pleine');
  if (players.some((p) => p.user_id !== userId && p.name.toLowerCase() === name.toLowerCase())) {
    throw new GameError('Ce prénom est déjà pris à cette table');
  }
}

export function botName(players: { name: string }[]): string {
  const taken = new Set(players.map((p) => p.name));
  return ONLINE_BOT_NAMES.find((n) => !taken.has(n)) ?? `Robot ${players.length + 1}`;
}

/** A robot for the next free seat, as a row to insert. */
export function newGameBot(room: GameRoomRow, players: GamePlayerRow[], hostId: string, id: string) {
  if (room.host_id !== hostId) throw new GameError('Seul le créateur de la table peut ajouter un robot');
  if (room.status !== 'lobby') throw new GameError('La partie a déjà commencé');
  if (players.length >= gameDef(room.game).maxPlayers) throw new GameError('La table est pleine');
  return {
    room_id: room.id,
    user_id: id,
    name: botName(players),
    seat: firstFreeGameSeat(players),
    is_bot: true,
    avatar: '🤖',
    avatar_color: '#90be6d',
  };
}

/** Starts the game, adding robots first when the game needs more seats. */
export function startGame(
  room: GameRoomRow,
  players: GamePlayerRow[],
  hostId: string,
  newId: () => string,
  rng: Rng,
  now: number,
) {
  if (room.host_id !== hostId) throw new GameError('Seul le créateur de la table peut lancer la partie');
  if (room.status !== 'lobby') throw new GameError('La partie a déjà commencé');
  const def = gameDef(room.game);
  const all = [...players];
  const bots: ReturnType<typeof newGameBot>[] = [];
  while (all.length < Math.max(def.fillTo ?? 0, def.minPlayers)) {
    const bot = newGameBot(room, all, hostId, newId());
    bots.push(bot);
    all.push(bot);
  }
  if (all.length > def.maxPlayers) throw new GameError('Trop de joueurs pour ce jeu');
  const seats = all
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({ id: p.user_id, name: p.name, bot: p.is_bot }));
  const state = rule(() => def.start(seats, room.options ?? {}, rng));
  return { bots, snapshot: snapshot({ game: room.game, seats, state, deadline: null }, now) };
}

function seatOf(secret: GameSecret, userId: string): number {
  const seat = secret.seats.findIndex((s) => s.id === userId);
  if (seat < 0) throw new GameError("Tu n'es pas à cette table");
  return seat;
}

/** A move from a player; `{ type: 'next' }` starts the next round once one is over. */
export function playGameMove(secret: GameSecret, userId: string, move: unknown, rng: Rng, now: number) {
  const def = gameDef(secret.game);
  const seat = seatOf(secret, userId);
  if (def.over(secret.state)) throw new GameError('La partie est finie');
  if ((move as { type?: unknown } | null)?.type === 'next') {
    if (!def.betweenRounds(secret.state)) throw new GameError('La manche n’est pas finie');
    return snapshot({ ...secret, state: rule(() => def.nextRound(secret.state, rng)) }, now);
  }
  if (!def.actors(secret.state).includes(seat)) throw new GameError('Ce n’est pas ton tour');
  return snapshot({ ...secret, state: rule(() => def.apply(secret.state, seat, move, rng)) }, now);
}

/** Once the wait is over: a robot plays, a slow player gets a move played for them, or the next round starts. */
export function playGameTimeout(secret: GameSecret, rng: Rng, now: number) {
  const def = gameDef(secret.game);
  if (secret.deadline === null || now < secret.deadline) throw new GameError('Pas encore');
  if (def.betweenRounds(secret.state)) {
    return snapshot({ ...secret, state: rule(() => def.nextRound(secret.state, rng)) }, now);
  }
  const actors = def.actors(secret.state);
  if (actors.length === 0) throw new GameError('Personne ne doit jouer');
  // Robots first, so a person who is still thinking keeps their turn.
  const seat = actors.find((s) => secret.seats[s].bot) ?? actors[0];
  const state = rule(() => def.apply(secret.state, seat, def.auto(secret.state, seat, rng), rng));
  return snapshot({ ...secret, state }, now);
}

/** Public state, private views and the next deadline after a change. */
export function snapshot(secret: GameSecret, now: number): GameSnapshot {
  const def = gameDef(secret.game);
  const over = def.over(secret.state);
  const betweenRounds = !over && def.betweenRounds(secret.state);
  const actors = over || betweenRounds ? [] : def.actors(secret.state);
  let deadline: number | null = null;
  if (betweenRounds) deadline = now + NEXT_MS;
  else if (actors.some((s) => secret.seats[s].bot)) deadline = now + BOT_MS;
  else if (actors.length > 0) deadline = now + TURN_MS;
  const next: GameSecret = { ...secret, deadline };
  const privates: Record<string, unknown> = {};
  secret.seats.forEach((s, i) => {
    if (!s.bot) privates[s.id] = def.view(secret.state, i);
  });
  return {
    secret: next,
    privates,
    public: {
      game: secret.game,
      seats: secret.seats,
      actors: actors.map((s) => secret.seats[s].id),
      deadline,
      betweenRounds,
      over,
      view: def.view(secret.state, null),
    },
  };
}

/** Experience to give after a save: a little for each finished round, more at the end of the game. */
export function progressAwards(before: GameSecret, after: GameSnapshot) {
  const def = gameDef(before.game);
  const people = before.seats.map((s, i) => ({ ...s, seat: i })).filter((s) => !s.bot);
  if (after.public.over && !def.over(before.state)) {
    const winners = new Set(def.winners(after.secret.state));
    return people.map((p) => {
      const won = winners.has(p.seat);
      return { userId: p.id, amount: XP_PLAY + (won ? XP_WIN : 0), finished: { won } };
    });
  }
  if (after.public.betweenRounds && !def.betweenRounds(before.state)) {
    return people.map((p) => ({ userId: p.id, amount: XP_ROUND, finished: null }));
  }
  return [];
}

/** The games of a tournament: 1 to 8 online games, in the order they will be played. */
export function cleanTournamentGames(raw: unknown): OnlineGameId[] {
  const games = Array.isArray(raw) ? raw.filter((g): g is OnlineGameId => isOnlineGame(g)) : [];
  if (games.length < 1 || games.length > 8) throw new GameError('Choisis de 1 à 8 parties');
  return games;
}

export function cleanTournamentName(raw: unknown): string {
  const name = String(raw ?? '').trim().slice(0, 30);
  return name || 'Tournoi entre amis';
}

/** Who won and who played a tournament table that just ended, or null while it goes on. */
export function tournamentResults(before: GameSecret, after: GameSnapshot): { userId: string; won: boolean }[] | null {
  const finished = progressAwards(before, after).filter((a) => a.finished);
  if (finished.length === 0) return null;
  return finished.map((a) => ({ userId: a.userId, won: a.finished!.won }));
}
