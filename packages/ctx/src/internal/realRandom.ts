import { asId } from "../../unsafe/asId.ts";
import type { Random } from "../Random.ts";

/** Platform randomness: crypto.randomUUID and Math.random (k.ctx). */
export function realRandom(): Random {
  return {
    id: (_brand) => asId(crypto.randomUUID()),
    float: () => Math.random(),
  };
}
