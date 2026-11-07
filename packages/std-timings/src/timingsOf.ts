import type { Ctx } from "@keel/ctx";
import type { Timings } from "./Timings.ts";
import { registerSection } from "./internal/registerSection.ts";
import { stats } from "./internal/stats.ts";

/** The `Timings` of `ctx` (std.timings), sorted by name; `{}` for a ctx with no `time` calls. */
export function timingsOf(ctx: Ctx): Timings {
  const byName = stats.get(ctx);
  if (byName === undefined) return {};
  const out: Timings = {};
  for (const name of [...byName.keys()].sort()) {
    const st = byName.get(name);
    if (st !== undefined) out[name] = { ...st };
  }
  return out;
}

registerSection(timingsOf);
