import { type Ctx, observe } from "@keel/ctx";
import type { Tally } from "./Tally.schema.ts";
import { TALLY_KEY } from "./internal/TALLY_KEY.ts";
import { countStore } from "./internal/countStore.ts";
import { mergeTally } from "./internal/mergeTally.ts";
import { readTally } from "./internal/readTally.ts";

const EVERY = 60_000;

/**
 * The production tally runner (std.monitor), a k.topology `Runner` a module lists in `runners.server.ts`. `run` observes
 * the server ctx: after each `save` it reads `keel.store.<store>` from `ctx.storage` and counts, by transaction `name`, the
 * log entries that save committed (`from < id <= head`), so another process's commits to a shared storage are left to
 * that process's monitor. Every 60,000 ms on `ctx.clock`, and once when `signal` aborts, it merges the counts into
 * `ctx.storage` key `sessions.tally` (read, add, write: `ctx.storage` has no compare-and-set, so two processes merging
 * at once can lose one side's counts), then `run` resolves; a merge whose write fails keeps its counts for the next
 * one. Names and counts only: no payload, caller, state or entry time is kept.
 */
export const monitor: { run(ctx: Ctx, signal: AbortSignal): Promise<void> } = {
  async run(ctx, signal) {
    let counts = new Map<string, number>();
    let queue: Promise<void> = Promise.resolve();
    const then = (step: () => Promise<void>): Promise<void> => {
      queue = queue.then(step).catch(() => undefined);
      return queue;
    };
    const merge = (): Promise<void> =>
      then(async () => {
        const now = ctx.clock.now();
        const add: Tally = { v: 1, from: now, to: now, tx: Object.fromEntries(counts) };
        counts = new Map();
        const stored = await readTally(ctx);
        try {
          await ctx.storage.set(TALLY_KEY, JSON.stringify(mergeTally(stored ?? { ...add, tx: {} }, add)));
        } catch {
          for (const [name, n] of Object.entries(add.tx)) counts.set(name, (counts.get(name) ?? 0) + n);
        }
      });
    const stop = observe(ctx, (e) => {
      if (e.kind !== "save") return;
      void then(() => countStore(ctx, e, counts));
    });
    try {
      while (!signal.aborted) {
        try {
          await ctx.clock.after(EVERY, signal);
        } catch {
          break;
        }
        await merge();
      }
    } finally {
      stop();
    }
    await merge();
  },
};
