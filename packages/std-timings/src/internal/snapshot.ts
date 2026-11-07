import type { Ctx } from "@keel/ctx";
import type { Timings } from "../Timings.ts";
import { stats } from "./stats.ts";

/** A copy of the `Timings` of `ctx`, sorted by name; `{}` for a ctx with no `time` calls. */
export function snapshot(ctx: Ctx): Timings {
  const st = stats.get(ctx);
  if (st === undefined) return {};
  const out: Timings = {};
  for (const name of [...st.byName.keys()].sort()) {
    const v = st.byName.get(name);
    if (v !== undefined) out[name] = { ...v };
  }
  return out;
}
