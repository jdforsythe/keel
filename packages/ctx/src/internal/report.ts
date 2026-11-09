import type { Ctx } from "../Ctx.ts";
import type { CtxEvent } from "../CtxEvent.ts";
import { KEPT_ERRORS } from "./KEPT_ERRORS.ts";
import { hubOf } from "./hubOf.ts";
import { hubs } from "./hubs.ts";
import { quietDepth } from "./quietDepth.ts";

/**
 * Deliver `event` to every observer of `ctx`, synchronously, in registration order; a throw in one is dropped
 * (k.ctx Observers). A `nav` is kept as the ctx's current route even when nothing observes, and the first
 * `KEPT_ERRORS` `error` events after it are kept with it, each stamped `at` (`clock.now()`), so an observer added later gets them with their report time. A `fire` inside
 * `quiet` (kernel code moving the focus) is dropped. Kernel producers only.
 */
export function report(ctx: Ctx | undefined, event: CtxEvent): void {
  if (ctx === undefined) return;
  // Kept for a new observer, stamped with the report time it replays them with.
  if (event.kind === "nav") {
    const hub = hubOf(ctx);
    hub.nav = { ...event, at: ctx.clock.now() };
    hub.errors = [];
  }
  if (event.kind === "error") {
    const kept = hubOf(ctx).errors;
    if (kept.length < KEPT_ERRORS) kept.push({ ...event, at: ctx.clock.now() });
  }
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
