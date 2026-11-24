import type { Ctx } from "@keel/ctx";
import type { Hub } from "./Hub.ts";

const hubs = new WeakMap<Ctx, Hub>();

/** The stream hub of a server ctx: one per process ctx, so delivery reaches the streams open in this process. */
export function hubOf(ctx: Ctx): Hub {
  const hit = hubs.get(ctx);
  if (hit !== undefined) return hit;
  const hub: Hub = { sinks: new Set(), stop: undefined, watch: undefined };
  hubs.set(ctx, hub);
  return hub;
}
