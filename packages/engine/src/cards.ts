export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc';

/** A card is two chars: rank then suit, e.g. "As", "Td", "2c". */
export type Card = string;

export type Rng = (maxExclusive: number) => number;

export function rankValue(card: Card): number {
  return RANKS.indexOf(card[0]) + 2;
}

export function suitOf(card: Card): string {
  return card[1];
}

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return deck;
}

/** Uniform integer in [0, maxExclusive) from the platform CSPRNG, without modulo bias. */
export const secureRng: Rng = (maxExclusive) => {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % maxExclusive;
};

export function shuffle(deck: Card[], rng: Rng = secureRng): Card[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
