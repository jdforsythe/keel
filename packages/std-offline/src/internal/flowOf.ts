import type { Ctx } from "@keel/ctx";
import type { Config } from "./Config.ts";
import type { Flow } from "./Flow.ts";

/** The flush and entries of outbox `c` on `ctx`, made on first use. */
export function flowOf(c: Config, ctx: Ctx): Flow {
  const hit = c.flows.get(ctx);
  if (hit !== undefined) return hit;
  const f: Flow = {
    busy: false,
    delay: 1000,
    timer: new AbortController(),
    again: undefined,
    owner: undefined,
    paused: false,
    ended: false,
    waits: new Map(),
    held: new Set(),
    kept: [],
  };
  c.flows.set(ctx, f);
  return f;
}
