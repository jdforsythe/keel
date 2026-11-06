import type { Random } from "../Random.ts";

/** Platform randomness: crypto.randomUUID and Math.random (k.ctx). */
export function realRandom(): Random {
  return {
    uuid: () => crypto.randomUUID(),
    float: () => Math.random(),
  };
}
