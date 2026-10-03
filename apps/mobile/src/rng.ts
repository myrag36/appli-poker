import { getRandomValues } from 'expo-crypto';
import type { Rng } from '@appli-poker/engine';

/** Uniform integer in [0, maxExclusive) from the device CSPRNG, without modulo bias. */
export const deviceRng: Rng = (maxExclusive) => {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  do getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % maxExclusive;
};
