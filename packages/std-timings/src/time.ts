import type { Ctx } from "@keel/ctx";
import { MAX_NAMES } from "./internal/MAX_NAMES.ts";
import { stats } from "./internal/stats.ts";

/** Add one duration under `name` for `ctx`; a new name beyond `MAX_NAMES` distinct names is not retained. */
function record(ctx: Ctx, name: string, ms: number): void {
  const byName = stats.get(ctx) ?? new Map();
  stats.set(ctx, byName);
  const d = Math.max(0, ms);
  const prior = byName.get(name);
  if (prior === undefined && byName.size >= MAX_NAMES) return; // first come, first kept: later names are dropped
  byName.set(
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
