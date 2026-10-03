import {
  type Action,
  type HandState,
  type HandView,
  type Rng,
  applyAction,
  bigBlindAt,
  blindLevel,
  handOutcomes,
  legalActions,
  secureRng,
  startHand,
  viewFor,
} from '../_shared/engine/index.ts';

export const MAX_PLAYERS = 8;
/** Time each player has to act before the server plays for them. */
export const TURN_MS = 45_000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface RoomRow {
  id: string;
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
  public_state?: PublicState | null;
}

/** Tournament level of the hand being played and when the next one starts (epoch ms). */
export interface LevelInfo {
  level: number;
  nextLevelAt: number;
}

/**
 * The public view plus when the player to act runs out of time (epoch ms) and,
 * in a tournament, the blind level.
 */
export type PublicState = HandView & { deadline: number | null; tournament?: LevelInfo | null };

export const LEVEL_CHOICES = [5, 10, 15, 20, 30];

export interface PlayerRow {
  user_id: string;
  name: string;
  seat: number;
  stack: number;
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

function publicState(hand: HandState, now: number, tournament: LevelInfo | null): PublicState {
  return { ...viewFor(hand, null), deadline: hand.toAct >= 0 ? now + TURN_MS : null, tournament };
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
  if (previous && previous.street !== 'finished') throw new GameError('La main en cours n\'est pas finie');
  const seated = players.filter((p) => p.stack > 0).sort((a, b) => a.seat - b.seat);
  if (seated.length < 2) throw new GameError('Il faut au moins 2 joueurs avec des jetons');

  // room.dealer holds the seat number of the last button, or -1 before the first hand.
  const lastButton = room.hand_number === 0 ? -1 : room.dealer;
  const next = seated.find((p) => p.seat > lastButton) ?? seated[0];
  const { bigBlind, tournament } = nextBlinds(room, now);
  const hand = startHand({
    seats: seated.map((p) => ({ id: p.user_id, name: p.name, stack: p.stack })),
    dealer: seated.indexOf(next),
    smallBlind: bigBlind / 2,
    bigBlind,
    rng,
  });
  return {
    p_room: room.id,
    p_version: room.version,
    p_public: publicState(hand, now, tournament),
    p_secret: hand,
    p_dealer: next.seat,
    p_hand_number: room.hand_number + 1,
    p_hands: Object.fromEntries(hand.players.map((p) => [p.id, p.hole])),
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
  let next: HandState;
  try {
    next = applyAction(hand, userId, action);
  } catch (e) {
    throw new GameError((e as Error).message);
  }
  return {
    p_room: room.id,
    p_version: room.version,
    p_public: publicState(next, now, room.public_state?.tournament ?? null),
    p_secret: next,
    p_stacks: stacksOf(next),
  };
}

/** Plays for a player whose time ran out: check when allowed, otherwise fold. */
export function playTimeout(room: RoomRow, hand: HandState, now: number): SaveParams {
  const deadline = room.public_state?.deadline;
  if (hand.toAct < 0 || !deadline) throw new GameError('Personne ne doit jouer');
  if (now < deadline) throw new GameError('Le temps n\'est pas encore écoulé');
  const actor = hand.players[hand.toAct];
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
  return {
    history: { ...key, summary },
    results: handOutcomes(summary).map((o) => ({
      ...key,
      user_id: o.id,
      net: o.net,
      won: o.won,
      best_pot: o.bestPot,
    })),
    game:
      players.length >= 2 && withChips.length === 1
        ? {
            room_id: room.id,
            winner_id: withChips[0].user_id,
            players: players.length,
            tournament: Boolean(room.level_minutes),
          }
        : null,
  };
}
