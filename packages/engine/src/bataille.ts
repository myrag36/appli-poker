import { type Rng, secureRng } from './cards.ts';

/**
 * Bataille navale (Battleship): each player hides a fleet of 5 ships on a 10 x 10 grid, then the
 * players take turns firing at a cell of the other's grid. "À l'eau", "touché" or "coulé" is announced;
 * the first to sink the whole enemy fleet wins. Ships may touch but never overlap.
 * Pure and immutable: every move returns a new state.
 */

export const BN_SIZE = 10;
/** Sizes of the fleet: porte-avions, croiseur, contre-torpilleur, sous-marin, torpilleur. */
export const BN_FLEET = [5, 4, 3, 3, 2] as const;
/** French name of each ship of the fleet, in the order of BN_FLEET (also the translation keys). */
export const BN_SHIP_NAMES = ['Porte-avions', 'Croiseur', 'Contre-torpilleur', 'Sous-marin', 'Torpilleur'];

export type BnPlayer = 0 | 1;
export type BnLevel = 'facile' | 'moyen' | 'difficile';

export const BN_LEVEL_LABELS: Record<BnLevel, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

/** A ship: its first (top-left) cell, its size, and whether it lies horizontally. */
export interface BnShip {
  x: number;
  y: number;
  size: number;
  horizontal: boolean;
}

/** A shot received on a grid: where, whether it hit, and the size of the ship it sank, if any. */
export interface BnShot {
  x: number;
  y: number;
  hit: boolean;
  sunk?: number;
}

/** One player's grid: their ships and the shots the opponent fired at it. */
export interface BnBoard {
  ships: BnShip[];
  shots: BnShot[];
}

export interface BnState {
  /** boards[p] is player p's own grid; null until that player has placed their fleet. */
  boards: [BnBoard | null, BnBoard | null];
  /** 'placement' while a fleet is missing, then 'tir' (shooting) until a fleet is sunk. */
  phase: 'placement' | 'tir' | 'fini';
  /** Whose turn it is to fire. */
  current: BnPlayer;
  winner: BnPlayer | null;
  /** The last shot fired, by whom, for the animation and the announcement. */
  lastShot: (BnShot & { by: BnPlayer }) | null;
  /** Shots fired so far by each player. */
  fired: [number, number];
}

export function bnNewGame(starter: BnPlayer = 0): BnState {
  return {
    boards: [null, null],
    phase: 'placement',
    current: starter,
    winner: null,
    lastShot: null,
    fired: [0, 0],
  };
}

export const bnOther = (p: BnPlayer): BnPlayer => (p === 0 ? 1 : 0);

/** The cells a ship covers, as [x, y]. */
export function bnShipCells(ship: BnShip): [number, number][] {
  return Array.from({ length: ship.size }, (_, i) =>
    ship.horizontal ? [ship.x + i, ship.y] : [ship.x, ship.y + i],
  );
}

const inside = (x: number, y: number) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < BN_SIZE && y < BN_SIZE;

/** Does the ship fit on the grid? */
export function bnShipFits(ship: BnShip): boolean {
  return bnShipCells(ship).every(([x, y]) => inside(x, y));
}

/** Can this ship be added to these ships: on the grid and over no other ship? */
export function bnCanPlace(ships: BnShip[], ship: BnShip): boolean {
  if (!bnShipFits(ship)) return false;
  const taken = new Set(ships.flatMap(bnShipCells).map(([x, y]) => y * BN_SIZE + x));
  return bnShipCells(ship).every(([x, y]) => !taken.has(y * BN_SIZE + x));
}

/** Checks a whole fleet sent by a player (shape, sizes, grid, overlaps) and returns a clean copy. */
export function bnCheckFleet(raw: unknown): BnShip[] {
  if (!Array.isArray(raw) || raw.length !== BN_FLEET.length) throw new Error('Flotte invalide');
  const ships: BnShip[] = [];
  for (const r of raw) {
    const s = r as Partial<BnShip> | null;
    if (
      !s ||
      typeof s.x !== 'number' ||
      typeof s.y !== 'number' ||
      typeof s.size !== 'number' ||
      typeof s.horizontal !== 'boolean'
    )
      throw new Error('Flotte invalide');
    // Before listing its cells: a huge size would build a huge array (or throw a RangeError).
    if (!(BN_FLEET as readonly number[]).includes(s.size)) throw new Error('Flotte invalide');
    const ship = { x: s.x, y: s.y, size: s.size, horizontal: s.horizontal };
    if (!bnCanPlace(ships, ship))
      throw new Error('Les bateaux doivent tenir sur la grille sans se chevaucher');
    ships.push(ship);
  }
  const sizes = ships.map((s) => s.size).sort((a, b) => b - a);
  if (sizes.some((n, i) => n !== BN_FLEET[i])) throw new Error('Flotte invalide');
  return ships;
}

/** A random fleet, in the order of BN_FLEET. Ships never touch, which looks nicer and is fair. */
export function bnRandomFleet(rng: Rng = secureRng): BnShip[] {
  for (;;) {
    const ships: BnShip[] = [];
    const blocked = new Set<number>();
    let ok = true;
    for (const size of BN_FLEET) {
      const options: BnShip[] = [];
      for (const horizontal of [true, false])
        for (let y = 0; y < BN_SIZE; y++)
          for (let x = 0; x < BN_SIZE; x++) {
            const ship = { x, y, size, horizontal };
            if (bnShipFits(ship) && bnShipCells(ship).every(([cx, cy]) => !blocked.has(cy * BN_SIZE + cx)))
              options.push(ship);
          }
      if (options.length === 0) {
        ok = false;
        break;
      }
      const ship = options[rng(options.length)];
      ships.push(ship);
      for (const [cx, cy] of bnShipCells(ship))
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (inside(cx + dx, cy + dy)) blocked.add((cy + dy) * BN_SIZE + cx + dx);
    }
    if (ok) return ships;
  }
}

/** Sets a player's fleet; shooting starts once both fleets are placed. */
export function bnPlace(state: BnState, player: BnPlayer, rawShips: unknown): BnState {
  if (state.phase !== 'placement') throw new Error('Les flottes sont déjà placées');
  if (state.boards[player]) throw new Error('Ta flotte est déjà placée');
  const ships = bnCheckFleet(rawShips);
  const boards: [BnBoard | null, BnBoard | null] = [...state.boards];
  boards[player] = { ships, shots: [] };
  return { ...state, boards, phase: boards[0] && boards[1] ? 'tir' : 'placement' };
}

/** The shot already fired at this cell of a grid, if any. */
export function bnShotAt(board: Pick<BnBoard, 'shots'>, x: number, y: number): BnShot | undefined {
  return board.shots.find((s) => s.x === x && s.y === y);
}

/** Is every cell of this ship hit? */
export function bnIsSunk(board: Pick<BnBoard, 'shots'>, ship: BnShip): boolean {
  return bnShipCells(ship).every(([x, y]) => bnShotAt(board, x, y)?.hit);
}

/** Ships of the grid that are sunk. */
export function bnSunkShips(board: BnBoard): BnShip[] {
  return board.ships.filter((s) => bnIsSunk(board, s));
}

/** Sizes of the ships still afloat on a grid, from the public information only (fleet minus sunk). */
export function bnAfloat(board: Pick<BnBoard, 'shots'>): number[] {
  const left: number[] = [...BN_FLEET];
  for (const s of board.shots)
    if (s.sunk) {
      const i = left.indexOf(s.sunk);
      if (i >= 0) left.splice(i, 1);
    }
  return left;
}

/** The current player fires at the other player's grid. Turns alternate after every shot. */
export function bnShoot(state: BnState, x: number, y: number): BnState {
  if (state.phase === 'placement') throw new Error('Les flottes ne sont pas encore placées');
  if (state.phase === 'fini') throw new Error('La partie est finie');
  if (!inside(x, y)) throw new Error('Case inconnue');
  const target = bnOther(state.current);
  const board = state.boards[target]!;
  if (bnShotAt(board, x, y)) throw new Error('Tu as déjà tiré sur cette case');
  const ship = board.ships.find((s) => bnShipCells(s).some(([cx, cy]) => cx === x && cy === y));
  const shot: BnShot = { x, y, hit: !!ship };
  const after: BnBoard = { ...board, shots: [...board.shots, shot] };
  if (ship && bnIsSunk(after, ship)) shot.sunk = ship.size;
  const won = after.ships.every((s) => bnIsSunk(after, s));
  const boards: [BnBoard | null, BnBoard | null] = [...state.boards];
  boards[target] = after;
  const fired: [number, number] = [...state.fired];
  fired[state.current]++;
  return {
    ...state,
    boards,
    fired,
    phase: won ? 'fini' : 'tir',
    winner: won ? state.current : null,
    current: won ? state.current : target,
    lastShot: { ...shot, by: state.current },
  };
}

/**
 * What a player may know of a grid that is not theirs: every shot, and only the ships already sunk.
 * Robots aim with this alone, and the online view sends nothing more.
 */
export function bnPublicBoard(board: BnBoard): BnBoard {
  return { ships: bnSunkShips(board), shots: board.shots };
}

// ---------------------------------------------------------------------------
// Robot

const N = BN_SIZE * BN_SIZE;
const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 0 unknown, 1 miss, 2 hit on a ship still afloat, 3 part of a sunk ship. */
function knowledge(board: BnBoard): Uint8Array {
  const k = new Uint8Array(N);
  for (const s of board.shots) k[s.y * BN_SIZE + s.x] = s.hit ? 2 : 1;
  for (const ship of bnSunkShips(board)) for (const [x, y] of bnShipCells(ship)) k[y * BN_SIZE + x] = 3;
  return k;
}

const pick = <T>(list: T[], rng: Rng) => list[rng(list.length)];

/** Unknown cells next to a hit that is not sunk yet, preferring the line of two hits in a row. */
function targetCells(k: Uint8Array): { line: number[]; around: number[] } {
  const line = new Set<number>();
  const around = new Set<number>();
  for (let i = 0; i < N; i++) {
    if (k[i] !== 2) continue;
    const x = i % BN_SIZE;
    const y = (i - x) / BN_SIZE;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny) || k[ny * BN_SIZE + nx] !== 0) continue;
      around.add(ny * BN_SIZE + nx);
      // Walk back over the hits on the other side: two or more in a row give the ship's direction.
      const bx = x - dx;
      const by = y - dy;
      if (inside(bx, by) && k[by * BN_SIZE + bx] === 2) line.add(ny * BN_SIZE + nx);
    }
  }
  return { line: [...line], around: [...around] };
}

/** How many ways the ships still afloat could cover each cell, given what is known. */
function density(k: Uint8Array, afloat: number[]): Float64Array {
  const d = new Float64Array(N);
  const hunting = !k.includes(2);
  for (const size of afloat)
    for (const horizontal of [true, false])
      for (let y = 0; y < BN_SIZE; y++)
        for (let x = 0; x < BN_SIZE; x++) {
          const cells = bnShipCells({ x, y, size, horizontal });
          if (!cells.every(([cx, cy]) => inside(cx, cy))) continue;
          let hits = 0;
          let blocked = false;
          for (const [cx, cy] of cells) {
            const v = k[cy * BN_SIZE + cx];
            if (v === 1 || v === 3) blocked = true;
            else if (v === 2) hits++;
          }
          if (blocked || (!hunting && hits === 0)) continue;
          // Placements through several known hits are much more likely.
          const weight = hunting ? 1 : 30 ** hits;
          for (const [cx, cy] of cells) if (k[cy * BN_SIZE + cx] === 0) d[cy * BN_SIZE + cx] += weight;
        }
  return d;
}

/**
 * The robot's shot at the opponent's grid, from the public information only (shots and sunk ships).
 * Facile fires mostly at random and only sometimes follows a hit; Moyen hunts on a checkerboard,
 * then follows a hit along its line until the ship sinks; Difficile works out where the remaining
 * ships can still be and fires at the most likely cell.
 */
export function bnBotShot(board: BnBoard, level: BnLevel, rng: Rng = secureRng): { x: number; y: number } {
  const k = knowledge(bnPublicBoard(board));
  const unknown: number[] = [];
  for (let i = 0; i < N; i++) if (k[i] === 0) unknown.push(i);
  if (unknown.length === 0) throw new Error('Aucune case libre');
  const at = (i: number) => ({ x: i % BN_SIZE, y: Math.floor(i / BN_SIZE) });
  const { line, around } = targetCells(k);

  if (level === 'facile') {
    if (around.length > 0 && rng(3) !== 0) return at(pick(around, rng));
    return at(pick(unknown, rng));
  }

  if (level === 'moyen') {
    if (line.length > 0) return at(pick(line, rng));
    if (around.length > 0) return at(pick(around, rng));
    // Every ship covers at least 2 cells in a row, so one cell in two is enough to find them all.
    const parity = unknown.filter((i) => (i % BN_SIZE) % 2 === Math.floor(i / BN_SIZE) % 2);
    return at(pick(parity.length > 0 ? parity : unknown, rng));
  }

  const d = density(k, bnAfloat(board));
  let best = -1;
  let cells: number[] = [];
  for (const i of unknown) {
    if (d[i] > best) {
      best = d[i];
      cells = [i];
    } else if (d[i] === best) cells.push(i);
  }
  if (best <= 0 && around.length > 0) return at(pick(around, rng));
  return at(pick(cells, rng));
}
