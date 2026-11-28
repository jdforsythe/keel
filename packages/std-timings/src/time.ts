import type { Ctx } from "@keel/ctx";
import { MAX_NAMES } from "./internal/MAX_NAMES.ts";
import { MAX_PROTECTED } from "./internal/MAX_PROTECTED.ts";
import { stats } from "./internal/stats.ts";

/**
 * Add one duration under `name` for `ctx` (rfc:0062, a segmented LRU). A new name joins `fresh`; at `MAX_NAMES` it
 * first evicts the least recent `fresh` name and counts it in `dropped`. A known name moves to the recent end of
 * `kept`; past `MAX_PROTECTED`, the least recent `kept` name moves back to `fresh`. Names called once (request-derived
 * ones) only churn `fresh`, so they never erase a name with history.
 */
function record(ctx: Ctx, name: string, ms: number): void {
  const st = stats.get(ctx) ?? { fresh: new Map(), kept: new Map(), dropped: 0 };
  stats.set(ctx, st);
  const d = Math.max(0, ms);
  const prior = st.kept.get(name) ?? st.fresh.get(name);
  if (prior === undefined) {
    if (st.fresh.size + st.kept.size >= MAX_NAMES) {
      const oldest = st.fresh.keys().next();
      if (oldest.done !== true) st.fresh.delete(oldest.value);
      st.dropped += 1;
    }
    st.fresh.set(name, { count: 1, totalMs: d, maxMs: d, lastMs: d });
    return;
  }
  st.fresh.delete(name);
  st.kept.delete(name);
  st.kept.set(name, {
    count: prior.count + 1,
    totalMs: prior.totalMs + d,
    maxMs: Math.max(prior.maxMs, d),
    lastMs: d,
  });
  for (const [old, stat] of st.kept) {
    if (st.kept.size <= MAX_PROTECTED) break;
    st.kept.delete(old);
    st.fresh.set(old, stat);
  }
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
