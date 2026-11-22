// @vitest-environment happy-dom
// Spec: k.sim, Conformance "`replay` of a `SimRun` whose `offline` is `[{ at: 100, ms: 50 }]`, its scenario advancing the clock to 120 with no `after` waiter pending: after `run()`, `ctx.net.online()` is true and `clock.now()` is 150; with `horizon: 130` it is still false."
// Spec: k.sim, simulate "`run()` settles ..., then while the earlier of `ctx.clock.next()` and the next edge (`at` or `at + ms`, later than the clock) of a window in the run's `schedule.offline` is at most `horizon` ms past the run's start, it advances the clock to it and settles again: no window edge within the horizon is left ahead of the clock."
// Spec: k.sim, Clock "`next()` returns the earliest pending deadline, else `null`." (unchanged: window edges are the schedule's, not the clock's)
// Seed: 1337 (fc.assert below). Pending: `run()` does not step to window edges yet.
// ASSUMPTION: the horizon counts from the run's start, the sim clock's 0; windows in the property are disjoint and ordered; `clock.advance` returns a promise.
import { simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

const runOf = (offline: { at: number; ms: number }[]) => ({
  seed: 1,
  schedule: { net: [], storage: [], offline, plans: {} },
});

/** Replays `offline`, advances the clock to `to`, calls `run()`, and returns what the ctx then says. */
async function after(offline: { at: number; ms: number }[], to: number, horizon?: number) {
  const seen: { online: boolean; now: number; next: number | null }[] = [];
  await simulate(
    async ({ ctx, run }) => {
      await ctx.clock.advance(to);
      await run();
      seen.push({ online: ctx.net.online(), now: ctx.clock.now(), next: ctx.clock.next() });
    },
    { replay: runOf(offline), ...(horizon === undefined ? {} : { horizon }) },
  );
  return seen[0];
}

test("`replay` of a `SimRun` whose `offline` is `[{ at: 100, ms: 50 }]`, its scenario advancing the clock to 120 with no `after` waiter pending: after `run()`, `ctx.net.online()` is true and `clock.now()` is 150; with `horizon: 130` it is still false.", async () => {
  expect(await after([{ at: 100, ms: 50 }], 120)).toMatchObject({ online: true, now: 150 });
  expect(await after([{ at: 100, ms: 50 }], 120, 130)).toMatchObject({ online: false, now: 120 });
});

test("`run()` leaves no window edge within the horizon ahead of the clock: for generated disjoint windows it stops at the last edge within the horizon", async () => {
  const windows = fc
    .array(fc.tuple(fc.integer({ min: 1, max: 400 }), fc.integer({ min: 1, max: 400 })), { minLength: 1, maxLength: 5 })
    .map((gaps) => {
      const out: { at: number; ms: number }[] = [];
      let t = 0;
      for (const [gap, ms] of gaps) {
        out.push({ at: t + gap, ms });
        t += gap + ms;
      }
      return out;
    });
  await fc.assert(
    fc.asyncProperty(windows, fc.integer({ min: 0, max: 2500 }), async (offline, horizon) => {
      const seen = await after(offline, 0, horizon);
      const edges = offline.flatMap((w) => [w.at, w.at + w.ms]).filter((e) => e <= horizon);
      const last = edges.length === 0 ? 0 : Math.max(...edges);
      expect(seen?.now).toBe(last);
      const inWindow = offline.some((w) => w.at <= last && last < w.at + w.ms);
      expect(seen?.online).toBe(!inWindow);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("`clock.next()` is unchanged: with no `after` waiter it is `null` before and after `run()` stepped to a window edge, and a pending `after` deadline is what it returns, never an edge", async () => {
  const seen: (number | null)[] = [];
  await simulate(
    async ({ ctx, run }) => {
      seen.push(ctx.clock.next());
      const ac = new AbortController();
      void ctx.clock.after(130, ac.signal).catch(() => undefined);
      seen.push(ctx.clock.next());
      ac.abort();
      await run();
      seen.push(ctx.clock.next());
    },
    { replay: runOf([{ at: 100, ms: 50 }]) },
  );
  expect(seen).toEqual([null, 130, null]);
});
