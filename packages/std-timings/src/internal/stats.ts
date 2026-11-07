import type { Ctx } from "@keel/ctx";
import type { Timings } from "../Timings.ts";

type Stat = Timings[string];

/**
 * Per-ctx statistics: `byName` in update order (least recently updated first, so eviction takes the first key) and
 * `dropped`, the names evicted at the cap so far. A ctx that is collected takes its timings with it.
 */
export const stats = new WeakMap<Ctx, { byName: Map<string, Stat>; dropped: number }>();
