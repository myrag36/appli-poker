import {
  type Action,
  type HandState,
  type HandView,
  type Rng,
  type Variant,
  AVATAR_COLORS,
  applyAction,
  bigBlindAt,
  blindLevel,
  botName,
  chooseBotAction,
  handOutcomes,
  legalActions,
  secureRng,
  startHand,
  viewFor,
} from '../_shared/engine/index.ts';

export const MAX_PLAYERS = 8;
/** Time each player has to act before the server plays for them. */
export const TURN_MS = 45_000;
/** How long a robot seems to think: any phone at the table then asks the server to play its move. */
export const BOT_MS = 1_500;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface RoomRow {
  id: string;
  /** The code friends join with (always read, optional for tests). */
  code?: string;
  host_id: string;
  big_blind: number;
  starting_stack: number;
  dealer: number;
  hand_number: number;
  version: number;
  /** Tournament level length, or null when the blinds never change. */
  level_minutes?: number | null;
  /** When the first hand was dealt (ISO date), used to time tournament levels. */
  started_at?: string | null;
  /** Set by the host: nobody can play, deal or time out until the game resumes. */
  paused?: boolean;
  /** Missing on tables created before Omaha existed, which are Hold'em. */
  variant?: Variant;
  public_state?: PublicState | null;
}

/** Tournament level of the hand being played and when the next one starts (epoch ms). */
export interface LevelInfo {
  level: number;
  nextLevelAt: number;
}

/**
 * The public view plus when the player to act runs out of time (epoch ms), in a
 * tournament the blind level, and which players are robots.
 */
export type PublicState = HandView & { deadline: number | null; tournament?: LevelInfo | null; bots?: string[] };

export const LEVEL_CHOICES = [5, 10, 15, 20, 30];
export const VARIANTS: Variant[] = ['holdem', 'omaha'];

export interface PlayerRow {
  user_id: string;
  name: string;
  seat: number;
  stack: number;
  /** Computer player added by the host; it has no account. */
  is_bot?: boolean;
}

/** Arguments for the `save_room_state` database function. */
export interface SaveParams {
  p_room: string;
  p_version: number;
  p_public: PublicState;
  p_secret: HandState;
  p_dealer?: number;
  p_hand_number?: number;
  p_stacks?: Record<string, number>;
  p_hands?: Record<string, string[]>;
}

export class GameError extends Error {}

const PAUSED = 'La partie est en pause';

export function makeRoomCode(rng: Rng = secureRng): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[rng(CODE_ALPHABET.length)];
  return code;
}

export function cleanName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim() : '';
  if (n.length < 1 || n.length > 16) throw new GameError('Choisis un prénom de 1 à 16 caractères');
  return n;
}

export function firstFreeSeat(players: PlayerRow[]): number {
  const taken = new Set(players.map((p) => p.seat));
  for (let s = 0; s < MAX_PLAYERS; s++) if (!taken.has(s)) return s;
  throw new GameError('La table est pleine (8 joueurs maximum)');
}

/** When the player to act runs out of time: a robot gets a short pause, a person a full turn. */
function deadlineFor(hand: HandView, bots: string[], now: number): number | null {
  if (hand.toAct < 0) return null;
  return now + (bots.includes(hand.players[hand.toAct].id) ? BOT_MS : TURN_MS);
}

function publicState(hand: HandState, now: number, tournament: LevelInfo | null, bots: string[]): PublicState {
  return { ...viewFor(hand, null), deadline: deadlineFor(hand, bots, now), tournament, bots };
}

/** Blinds for the next hand: fixed, or grown with the time played in a tournament. */
export function nextBlinds(room: RoomRow, now: number): { bigBlind: number; tournament: LevelInfo | null } {
  if (!room.level_minutes) return { bigBlind: room.big_blind, tournament: null };
  const startedAt = room.started_at ? Date.parse(room.started_at) : now;
  const tournament = blindLevel(startedAt, now, room.level_minutes);
  return { bigBlind: bigBlindAt(room.big_blind, tournament.level), tournament };
}

function stacksOf(hand: HandState): Record<string, number> {
  return Object.fromEntries(hand.players.map((p) => [p.id, p.stack]));
}

/** Deals the next hand. The button moves to the next seat that still has chips. */
export function dealNextHand(
  room: RoomRow,
  players: PlayerRow[],
  previous: HandState | null,
  now: number,
  rng?: Rng,
): SaveParams {
  if (room.paused) throw new GameError(PAUSED);
  if (previous && previous.street !== 'finished') throw new GameError('La main en cours n\'est pas finie');
  const seated = players.filter((p) => p.stack > 0).sort((a, b) => a.seat - b.seat);
  if (seated.length < 2) throw new GameError('Il faut au moins 2 joueurs avec des jetons');

  // room.dealer holds the seat number of the last button, or -1 before the first hand.
  const lastButton = room.hand_number === 0 ? -1 : room.dealer;
  const next = seated.find((p) => p.seat > lastButton) ?? seated[0];
  const { bigBlind, tournament } = nextBlinds(room, now);
  const bots = seated.filter((p) => p.is_bot).map((p) => p.user_id);
  const hand = startHand({
    seats: seated.map((p) => ({ id: p.user_id, name: p.name, stack: p.stack })),
    dealer: seated.indexOf(next),
    smallBlind: bigBlind / 2,
    bigBlind,
    rng,
    variant: room.variant ?? 'holdem',
  });
  return {
    p_room: room.id,
    p_version: room.version,
    p_public: publicState(hand, now, tournament, bots),
    p_secret: hand,
    p_dealer: next.seat,
    p_hand_number: room.hand_number + 1,
    // Robots have no account to read their cards with; theirs stay in the secret state.
    p_hands: Object.fromEntries(hand.players.filter((p) => !bots.includes(p.id)).map((p) => [p.id, p.hole])),
    // Stacks are saved with blinds already posted, so a player leaving mid-hand cannot dodge them.
    p_stacks: stacksOf(hand),
  };
}

export function parseAction(raw: unknown): Action {
  const a = raw as { type?: unknown; to?: unknown } | null;
  switch (a?.type) {
    case 'fold':
    case 'check':
    case 'call':
    case 'allin':
      return { type: a.type };
    case 'raise':
      if (typeof a.to !== 'number' || !Number.isInteger(a.to)) throw new GameError('Montant invalide');
      return { type: 'raise', to: a.to };
    default:
      throw new GameError('Action inconnue');
  }
}

export function playAction(
  room: RoomRow,
  hand: HandState,
  userId: string,
  action: Action,
  now: number,
): SaveParams {
  if (room.paused) throw new GameError(PAUSED);
  let next: HandState;
  try {
    next = applyAction(hand, userId, action);
  } catch (e) {
    throw new GameError((e as Error).message);
  }
  return {
    p_room: room.id,
    p_version: room.version,
    p_public: publicState(next, now, room.public_state?.tournament ?? null, room.public_state?.bots ?? []),
    p_secret: next,
    p_stacks: stacksOf(next),
  };
}

/** Robots only need ordinary randomness to vary their play. */
const botRng: Rng = (max) => Math.floor(Math.random() * max);

/** Plays for a player whose time ran out: a robot plays its move, a person checks if allowed, otherwise folds. */
export function playTimeout(room: RoomRow, hand: HandState, now: number): SaveParams {
  if (room.paused) throw new GameError(PAUSED);
  const deadline = room.public_state?.deadline;
  if (hand.toAct < 0 || !deadline) throw new GameError('Personne ne doit jouer');
  if (now < deadline) throw new GameError('Le temps n\'est pas encore écoulé');
  const actor = hand.players[hand.toAct];
  if (room.public_state?.bots?.includes(actor.id)) {
    return playAction(room, hand, actor.id, chooseBotAction(hand, actor.id, botRng), now);
  }
  const legal = legalActions(hand, actor.id)!;
  return playAction(room, hand, actor.id, legal.check ? { type: 'check' } : { type: 'fold' }, now);
}

/** Rows saved once a hand is over, for statistics and the hand history. */
export interface HandRecords {
  history: { room_id: string; hand_number: number; summary: PublicState };
  results: {
    room_id: string;
    hand_number: number;
    user_id: string;
    net: number;
    won: boolean;
    best_pot: number;
  }[];
  /** Set when only one player has chips left, which ends the game. */
  game: { room_id: string; winner_id: string; players: number; tournament: boolean } | null;
}

/** What to record after a save, or null if the hand is still being played. */
export function handRecords(room: RoomRow, players: PlayerRow[], saved: SaveParams): HandRecords | null {
  const summary = saved.p_public;
  if (summary.street !== 'finished') return null;
  // Dealing saves the new hand number; moves keep the room's.
  const key = { room_id: room.id, hand_number: saved.p_hand_number ?? room.hand_number };
  const stackOf = (p: PlayerRow) => saved.p_stacks?.[p.user_id] ?? p.stack;
  const withChips = players.filter((p) => stackOf(p) > 0);
  // Statistics are for people: robots have no account to keep them.
  const bots = new Set(players.filter((p) => p.is_bot).map((p) => p.user_id));
  return {
    history: { ...key, summary },
    results: handOutcomes(summary)
      .filter((o) => !bots.has(o.id))
      .map((o) => ({
        ...key,
        user_id: o.id,
        net: o.net,
        won: o.won,
        best_pot: o.bestPot,
      })),
    game:
      players.length >= 2 && withChips.length === 1 && !bots.has(withChips[0].user_id)
        ? {
            room_id: room.id,
            winner_id: withChips[0].user_id,
            players: players.length,
            tournament: Boolean(room.level_minutes),
          }
        : null,
  };
}

/**
 * Pausing stops the turn clock; resuming gives the player to act a full turn again.
 * Returns the new public state, or null when no hand is being played.
 */
export function pausedState(room: RoomRow, paused: boolean, now: number): PublicState | null {
  const state = room.public_state;
  if (!state || state.street === 'finished') return state ?? null;
  return { ...state, deadline: paused ? null : deadlineFor(state, state.bots ?? [], now) };
}

/** Checks that the host may remove this player now. */
export function checkRemoval(room: RoomRow, players: PlayerRow[], hostId: string, targetId: string) {
  if (room.host_id !== hostId) throw new GameError('Seul le créateur de la table peut retirer un joueur');
  if (targetId === hostId) throw new GameError('Tu ne peux pas te retirer toi-même');
  if (!players.some((p) => p.user_id === targetId)) throw new GameError("Ce joueur n'est plus à la table");
  const hand = room.public_state;
  if (hand && hand.street !== 'finished' && hand.players.some((p) => p.id === targetId)) {
    throw new GameError('Attends la fin de la main pour retirer ce joueur');
  }
}

export const MAX_BOTS = 7;

/** The robot the host wants to add: a free seat, a free name, and the table's starting chips. */
export function newBot(room: RoomRow, players: PlayerRow[], hostId: string, id: string) {
  if (room.host_id !== hostId) throw new GameError('Seul le créateur de la table peut ajouter un robot');
  if (players.length >= MAX_PLAYERS) throw new GameError('La table est pleine (8 joueurs maximum)');
  const seat = firstFreeSeat(players);
  return {
    room_id: room.id,
    user_id: id,
    name: botName(players.map((p) => p.name)),
    seat,
    stack: room.starting_stack,
    is_bot: true,
    avatar: '🤖',
    avatar_color: AVATAR_COLORS[seat % AVATAR_COLORS.length],
  };
}
