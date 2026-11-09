import type { Ctx } from "./Ctx.ts";
import type { CtxEvent } from "./CtxEvent.ts";
import { hubOf } from "./internal/hubOf.ts";

/**
 * Subscribe `fn` to the events kernel code reports on `ctx` (k.ctx Observers): navigations, input events, resource
 * states and caught errors, synchronously and in order. `fn` first receives the ctx's current `nav`, if one exists,
 * then the `error` events reported since it (the first 16), so an observer started late still sees a first-load
 * error. A throw in `fn` is dropped. Returns the stop function; after it runs `fn` gets nothing more. Idempotent.
 * Observing is a capability: a module calling it lists `observe` in its manifest `capabilities`, which `keel check`
 * enforces (E1156). A ctx carries no module identity, so nothing is checked here.
 */
export function observe(ctx: Ctx, fn: (event: CtxEvent) => void): () => void {
  const own = hubOf(ctx);
  const me = (event: CtxEvent): void => fn(event);
  own.fns.push(me);
  for (const kept of [...(own.nav === undefined ? [] : [own.nav]), ...own.errors])
    try {
      me(kept);
    } catch {
      // Same isolation as report.
    }
  return () => {
    const i = own.fns.indexOf(me);
    if (i >= 0) own.fns.splice(i, 1);
  };
}
