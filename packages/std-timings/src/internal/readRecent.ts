import type { Ctx } from "@keel/ctx";
import type { TimingsRecent } from "../TimingsRecent.ts";
import { snapshot } from "./snapshot.ts";
import { stats } from "./stats.ts";

/** The `timings.recent` value (rfc:0059): the timings of `ctx` and the names it evicted at the cap. */
export function readRecent(ctx: Ctx): TimingsRecent {
  return { timings: snapshot(ctx), dropped: stats.get(ctx)?.dropped ?? 0 };
}
