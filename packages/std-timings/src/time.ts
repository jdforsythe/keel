import type { Ctx } from "@keel/ctx";
import { MAX_NAMES } from "./internal/MAX_NAMES.ts";
import { stats } from "./internal/stats.ts";

/**
 * Add one duration under `name` for `ctx`. The name moves to the most recent end; a new name at `MAX_NAMES` evicts
 * the least recently updated one and counts it in `dropped` (rfc:0059), so request-derived names cannot starve others.
 */
function record(ctx: Ctx, name: string, ms: number): void {
  const st = stats.get(ctx) ?? { byName: new Map(), dropped: 0 };
  stats.set(ctx, st);
  const d = Math.max(0, ms);
  const prior = st.byName.get(name);
  if (prior === undefined && st.byName.size >= MAX_NAMES) {
    const oldest = st.byName.keys().next();
    if (oldest.done !== true) st.byName.delete(oldest.value);
    st.dropped += 1;
  }
  st.byName.delete(name);
  st.byName.set(
    name,
    prior === undefined
      ? { count: 1, totalMs: d, maxMs: d, lastMs: d }
      : { count: prior.count + 1, totalMs: prior.totalMs + d, maxMs: Math.max(prior.maxMs, d), lastMs: d },
  );
}

/**
 * Time `fn` with `ctx.clock` under `name` (std.timings): the duration is recorded for `ctx` whether `fn` resolves or
 * rejects, and `fn`'s outcome is returned or rethrown unchanged.
 */
export async function time<T>(ctx: Ctx, name: string, fn: () => Promise<T> | T): Promise<T> {
  const start = ctx.clock.now();
  try {
    return await fn();
  } finally {
    record(ctx, name, ctx.clock.now() - start);
  }
}
