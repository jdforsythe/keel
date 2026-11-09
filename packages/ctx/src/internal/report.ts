import type { Ctx } from "../Ctx.ts";
import type { CtxEvent } from "../CtxEvent.ts";
import { hubOf } from "./hubOf.ts";
import { hubs } from "./hubs.ts";
import { quietDepth } from "./quietDepth.ts";

/**
 * Deliver `event` to every observer of `ctx`, synchronously, in registration order; a throw in one is dropped
 * (k.ctx Observers). A `nav` is kept as the ctx's current route even when nothing observes. A `fire` inside `quiet`
 * (kernel code moving the focus) is dropped. Kernel producers only.
 */
export function report(ctx: Ctx | undefined, event: CtxEvent): void {
  if (ctx === undefined) return;
  if (event.kind === "nav") hubOf(ctx).nav = event;
  if (event.kind === "fire" && quietDepth.n > 0) return;
  const fns = hubs.get(ctx)?.fns;
  if (fns === undefined || fns.length === 0) return;
  for (const fn of [...fns])
    try {
      fn(event);
    } catch {
      // Observing never changes app behavior (k.ctx Observers).
    }
}
