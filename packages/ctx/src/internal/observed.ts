import type { Ctx } from "../Ctx.ts";
import { hubs } from "./hubs.ts";

/** Whether anything observes `ctx`: producers check it before building a hot-path event, so unobserved costs nothing. */
export function observed(ctx: Ctx | undefined): boolean {
  return ctx !== undefined && (hubs.get(ctx)?.fns.length ?? 0) > 0;
}
