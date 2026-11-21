import type { Danger } from "./Danger.ts";
import type { Loud } from "./Loud.ts";
import type { Novelty } from "./Novelty.ts";

const TABLE: Readonly<Record<Danger, readonly [Loud, Loud, Loud]>> = {
  critical: ["fail", "fail", "fail"],
  high: ["fail", "fail", "warn"],
  medium: ["warn", "warn", "list"],
  low: ["list", "list", "list"],
};
const QUIETER: Readonly<Record<Loud, Loud>> = { fail: "warn", warn: "list", list: "list", count: "count" };

/** k.review Loudness: danger by novelty, `accepted` only counted, an opt-in one step quieter. */
export function loudness(danger: Danger, novelty: Novelty, opt: boolean): Loud {
  if (novelty === "accepted") return "count";
  const row = TABLE[danger];
  const loud = novelty === "new" ? row[0] : novelty === "changed" ? row[1] : row[2];
  return opt ? QUIETER[loud] : loud;
}
