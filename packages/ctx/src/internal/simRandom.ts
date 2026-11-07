import { asId } from "../../unsafe/asId.ts";
import type { Random } from "../Random.ts";
import { uuidFromWords } from "./uuidFromWords.ts";
import { xoshiro128 } from "./xoshiro128.ts";

/** Seeded randomness: id and float draw from one xoshiro128** stream. */
export function simRandom(seed: number): Random {
  const next = xoshiro128(seed);
  const uuid = (): string => {
    const a = next();
    const b = next();
    const c = next();
    return uuidFromWords(a, b, c, next());
  };
  return {
    id: (_brand) => asId(uuid()),
    float: () => next() / 4294967296,
  };
}
