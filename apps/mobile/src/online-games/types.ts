import type { ComponentType } from 'react';
import type { OnlineSeat } from '@appli-poker/engine';
import type { SeatAvatar } from '../components/AvatarPicker';

/**
 * A seat at an online table, with the avatar its player chose. The avatar also carries the
 * player's latest emoji reaction, which `AvatarBadge` shows wherever the board draws it.
 */
export interface BoardSeat extends OnlineSeat {
  avatar: SeatAvatar;
}

/** What the online table screen gives each game's board once the game has started. */
export interface OnlineBoardProps<V = unknown> {
  /** My own view of the game (with my hidden cards), or the public one if I am not seated. */
  view: V;
  /** My seat index in `seats`, or -1 when I am only watching. */
  mySeat: number;
  /** Everyone at the table, in seat order (the order the game uses). */
  seats: BoardSeat[];
  /** Ids of the players who may move now. */
  actors: string[];
  /** When the current wait ends (epoch ms): a turn, a robot's pause or the pause between rounds. */
  deadline: number | null;
  /** A clock that ticks while someone is waited for, for the turn timer. */
  now: number;
  betweenRounds: boolean;
  over: boolean;
  /** A move is being sent: buttons should wait. */
  busy: boolean;
  /** The server refused the last move, in French. */
  error: string | null;
  /** Sends a move for my seat. `{ type: 'next' }` starts the next round when one is over. */
  onMove: (move: unknown) => void;
  /** Leaves the table screen (back to the game's home). */
  onLeave: () => void;
}

/** Options chosen when creating a table (target score, number of rounds…). */
export interface OnlineOptionsProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}

export interface OnlineGameUi {
  title: string;
  emoji: string;
  /** One line under the table code, e.g. "2 à 6 joueurs, les robots complètent". */
  players: string;
  Board: ComponentType<OnlineBoardProps<any>>;
  Options?: ComponentType<OnlineOptionsProps>;
  defaultOptions: Record<string, unknown>;
}
