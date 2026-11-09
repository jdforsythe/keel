import type { Ctx } from "../Ctx.ts";
import type { Hub } from "./Hub.ts";
import { hubs } from "./hubs.ts";

/** The hub of `ctx`, created on first use. */
export function hubOf(ctx: Ctx): Hub {
  const hub = hubs.get(ctx);
  if (hub !== undefined) return hub;
  const made: Hub = { fns: [], nav: undefined };
  hubs.set(ctx, made);
  return made;
}
