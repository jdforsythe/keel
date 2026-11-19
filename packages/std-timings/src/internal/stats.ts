import type { Ctx } from "@keel/ctx";
import type { Timings } from "../Timings.ts";

type Stat = Timings[string];

/**
 * Per-ctx statistics in two segments (rfc:0062), each a `Map` in update order (least recent first): `fresh` holds
 * names called once since they joined, `kept` the names called again; `dropped` counts names evicted at the cap. A
 * ctx that is collected takes its timings with it.
 */
export const stats = new WeakMap<Ctx, { fresh: Map<string, Stat>; kept: Map<string, Stat>; dropped: number }>();
