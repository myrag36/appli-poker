import {
  type Action,
  type HandState,
  type HandView,
  type Rng,
  applyAction,
  secureRng,
  startHand,
  viewFor,
} from '../_shared/engine/index.ts';

export const MAX_PLAYERS = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface RoomRow {
  id: string;
  host_id: string;
  big_blind: number;
  starting_stack: number;
  dealer: number;
  hand_number: number;
  version: number;
}

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
  p_public: HandView;
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

function stacksOf(hand: HandState): Record<string, number> {
  return Object.fromEntries(hand.players.map((p) => [p.id, p.stack]));
}

/** Deals the next hand. The button moves to the next seat that still has chips. */
export function dealNextHand(
  room: RoomRow,
  players: PlayerRow[],
  previous: HandState | null,
  rng?: Rng,
): SaveParams {
  if (previous && previous.street !== 'finished') throw new GameError('La main en cours n\'est pas finie');
  const seated = players.filter((p) => p.stack > 0).sort((a, b) => a.seat - b.seat);
  if (seated.length < 2) throw new GameError('Il faut au moins 2 joueurs avec des jetons');

  // room.dealer holds the seat number of the last button, or -1 before the first hand.
  const lastButton = room.hand_number === 0 ? -1 : room.dealer;
  const next = seated.find((p) => p.seat > lastButton) ?? seated[0];
  const hand = startHand({
    seats: seated.map((p) => ({ id: p.user_id, name: p.name, stack: p.stack })),
    dealer: seated.indexOf(next),
    smallBlind: room.big_blind / 2,
    bigBlind: room.big_blind,
    rng,
  });
  return {
    p_room: room.id,
    p_version: room.version,
    p_public: viewFor(hand, null),
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

export function playAction(room: RoomRow, hand: HandState, userId: string, action: Action): SaveParams {
  let next: HandState;
  try {
    next = applyAction(hand, userId, action);
  } catch (e) {
    throw new GameError((e as Error).message);
  }
  return {
    p_room: room.id,
    p_version: room.version,
    p_public: viewFor(next, null),
    p_secret: next,
    p_stacks: stacksOf(next),
  };
}
