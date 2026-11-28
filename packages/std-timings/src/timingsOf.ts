import type { Ctx } from "@keel/ctx";
import type { Timings } from "./Timings.schema.ts";
import { readRecent } from "./internal/readRecent.ts";
import { registerSection } from "./internal/registerSection.ts";
import { snapshot } from "./internal/snapshot.ts";

/** The `Timings` of `ctx` (std.timings), sorted by name; `{}` for a ctx with no `time` calls. */
export function timingsOf(ctx: Ctx): Timings {
  return snapshot(ctx);
}

registerSection(readRecent);
