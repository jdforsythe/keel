import type { Ctx } from "@keel/ctx";
import type { Timings } from "../Timings.ts";

type Stat = Timings[string];

/** Per-ctx statistics by name; a ctx that is collected takes its timings with it. */
export const stats = new WeakMap<Ctx, Map<string, Stat>>();
