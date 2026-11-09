import type { Ctx } from "./Ctx.ts";
import type { CtxEvent } from "./CtxEvent.ts";
import { hubOf } from "./internal/hubOf.ts";

/**
 * Subscribe `fn` to the events kernel code reports on `ctx` (k.ctx Observers, rfc:0070): navigations, input events,
 * resource states and caught errors, synchronously and in order. `fn` first receives the ctx's current `nav`, if one
 * exists. A throw in `fn` is dropped. Returns the stop function; after it runs `fn` gets nothing more. Idempotent.
 */
export function observe(ctx: Ctx, fn: (event: CtxEvent) => void): () => void {
  const own = hubOf(ctx);
  const me = (event: CtxEvent): void => fn(event);
  own.fns.push(me);
  if (own.nav !== undefined)
    try {
      me(own.nav);
    } catch {
      // Same isolation as report.
    }
  return () => {
    const i = own.fns.indexOf(me);
    if (i >= 0) own.fns.splice(i, 1);
  };
}
