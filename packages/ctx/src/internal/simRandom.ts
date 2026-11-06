import type { Random } from "../Random.ts";
import { uuidFromWords } from "./uuidFromWords.ts";
import { xoshiro128 } from "./xoshiro128.ts";

/** Seeded randomness: uuid and float draw from one xoshiro128** stream. */
export function simRandom(seed: number): Random {
  const next = xoshiro128(seed);
  return {
    float: () => next() / 4294967296,
    uuid: () => {
      const a = next();
      const b = next();
      const c = next();
      return uuidFromWords(a, b, c, next());
    },
  };
}
