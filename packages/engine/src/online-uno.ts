import type { Card, Rng } from './cards.ts';
import type { OnlineGame, OnlineSeat } from './online.ts';
import {
  type UnoMove,
  type UnoState,
  type UnoVariant,
  UNO_MAX_PLAYERS,
  UNO_TARGETS,
  unoApply,
  unoBotCatches,
  unoBotMove,
  unoCanCatch,
  unoCanSay,
  unoNewGame,
  unoNextRound,
} from './uno.ts';

export interface UnoOnlineState {
  game: UnoState;
  /** Which seats robots play, so only people get the time to catch a forgotten announcement. */
  bots: boolean[];
}

/** A card someone else holds, or the card they just drew: only its place is known. */
export const UNO_HIDDEN: Card = '??';

/** What a seat sees: the engine's state without the draw pile nor the others' cards. */
export interface UnoView extends UnoState {
  /** Always empty: only its size is known, in `deckCount`. */
  deck: Card[];
  deckCount: number;
  bots: boolean[];
}

/** Robots catch a person who forgot to announce more often than another robot. */
const CATCH_HUMAN = 70;
const CATCH_ROBOT = 40;

/** The target offered by default when creating a table: the middle one (200 or 100 points). */
export function unoDefaultTarget(variant: UnoVariant): number {
  return UNO_TARGETS[variant][1];
}

/** Checks the shape of a move sent by a phone: nothing in it is trusted. */
function parseMove(raw: unknown): UnoMove {
  const m = raw as {
    type?: unknown;
    card?: unknown;
    color?: unknown;
    say?: unknown;
    target?: unknown;
  } | null;
  if (!m || typeof m !== 'object') throw new Error('Coup inconnu.');
  switch (m.type) {
    case 'draw':
    case 'pass':
    case 'say':
      return { type: m.type };
    case 'catch':
      if (typeof m.target !== 'number' || !Number.isInteger(m.target)) throw new Error('Coup inconnu.');
      return { type: 'catch', target: m.target };
    case 'play':
      if (typeof m.card !== 'string' || m.card.length > 3) throw new Error('Carte inconnue.');
      if (m.color !== undefined && typeof m.color !== 'string') throw new Error('Choisis une couleur');
      return {
        type: 'play',
        card: m.card,
        color: m.color as string | undefined,
        say: m.say === true ? true : undefined,
      };
    default:
      throw new Error('Coup inconnu.');
  }
}

/** Removes every hidden card: the others' hands while a round is played, the draw pile, old discards. */
export function unoView(s: UnoOnlineState, seat: number | null): UnoView {
  const g = s.game;
  const open = g.phase !== 'playing';
  return {
    ...g,
    players: g.players.map((p, i) => (i === seat || open ? p : { ...p, hand: p.hand.map(() => UNO_HIDDEN) })),
    deck: [],
    deckCount: g.deck.length,
    // Only the top of the discard pile is shown, with the two cards just under it.
    discard: g.discard.slice(-3),
    drawn: g.drawn !== null && g.current !== seat ? UNO_HIDDEN : g.drawn,
    bots: s.bots,
  };
}

/**
 * Uno or 8 américain for 2 to 6 seats (robots complete the table to 2). Besides the player
 * whose turn it is, people may move when someone forgot to announce their last card: the
 * forgetful one to announce it, the others to catch them. Robots catch on their own turn.
 */
export function unoOnline(variant: UnoVariant): OnlineGame<UnoOnlineState> {
  const targets = UNO_TARGETS[variant];
  return {
    minPlayers: 1,
    maxPlayers: UNO_MAX_PLAYERS,
    fillTo: 2,
    options(raw) {
      const target = (raw as { target?: unknown } | null)?.target ?? unoDefaultTarget(variant);
      if (typeof target !== 'number' || !targets.includes(target))
        throw new Error('Durée de partie inconnue');
      return { target };
    },
    start(seats: OnlineSeat[], options, rng: Rng) {
      const target = targets.includes(options.target as number)
        ? (options.target as number)
        : unoDefaultTarget(variant);
      return {
        game: unoNewGame(
          variant,
          seats.map((p) => ({ id: p.id, name: p.name })),
          target,
          rng,
        ),
        bots: seats.map((p) => p.bot),
      };
    },
    actors(s) {
      const g = s.game;
      if (g.phase !== 'playing') return [];
      const out = [g.current];
      if (g.exposed !== null)
        g.players.forEach((_, i) => {
          if (i !== g.current && !s.bots[i]) out.push(i);
        });
      return out;
    },
    toPlay: (s) => (s.game.phase === 'playing' ? [s.game.current] : []),
    apply(s, seat, move, rng) {
      return { ...s, game: unoApply(s.game, seat, parseMove(move), rng) };
    },
    auto(s, seat, rng) {
      const g = s.game;
      if (g.phase !== 'playing') throw new Error('La manche est finie');
      const exposed = g.exposed;
      if (seat !== g.current) {
        if (unoCanSay(g, seat)) return { type: 'say' };
        if (exposed !== null && unoCanCatch(g, seat, exposed)) return { type: 'catch', target: exposed };
        throw new Error('Ce n’est pas son tour.');
      }
      // A robot first catches whoever forgot to announce, if it notices.
      if (
        s.bots[seat] &&
        exposed !== null &&
        unoCanCatch(g, seat, exposed) &&
        unoBotCatches(g, rng, s.bots[exposed] ? CATCH_ROBOT : CATCH_HUMAN)
      )
        return { type: 'catch', target: exposed };
      // A person who let their time run out never forgets the announcement.
      return unoBotMove(g, seat, rng, s.bots[seat] ? undefined : 0);
    },
    betweenRounds: (s) => s.game.phase === 'roundOver',
    nextRound: (s, rng) => ({ ...s, game: unoNextRound(s.game, rng) }),
    over: (s) => s.game.phase === 'gameOver',
    winners: (s) => (s.game.winner === null ? [] : [s.game.winner]),
    view: unoView,
  };
}

export const unoOnlineGame = unoOnline('uno');
export const huitOnlineGame = unoOnline('huit');
