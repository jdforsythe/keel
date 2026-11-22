// Spec: k.sim, simulate "`run()` settles as the harness does (k.testing `settle`), then (a `ctx.net` route that has not answered is work in flight: `run()` waits for it, and with nothing else moving the run's clock steps) while the earlier of ..." (rfc:0194)
// Spec: k.sim, Conformance "A `ctx.net` route that awaits a promise the scenario resolves after `run()` starts, or a `ctx.clock.after` of the run: `run()` resolves once the route has answered, never before."
// Seed: 1337 (fc.assert below). No timer is used: the promise is released after a generated number of microtask hops.
// ASSUMPTION: a route's answer is the settling of its handler; `ctx.net.fetch` is the first fetch of the run, so `net` is empty and its step is `{ delay: 0, fault: 'none' }`.
import { simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

const URL_BASE = "https://sim.test/";
const replay = { seed: SEED, schedule: { net: [], storage: [], offline: [], plans: {} } };
const hops = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

test("A `ctx.net` route that awaits a promise the scenario resolves after `run()` starts: `run()` resolves once the route has answered, never before", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 200 }), async (delayHops) => {
      let answered = false;
      let answeredAtRunEnd: boolean | undefined;
      await simulate(
        async ({ ctx, run }) => {
          let release: () => void = () => undefined;
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          ctx.net.route(`${URL_BASE}*`, async () => {
            await gate;
            answered = true;
            return new Response("late");
          });
          void ctx.net.fetch(new Request(URL_BASE));
          const running = run();
          void hops(delayHops).then(release);
          await running;
          answeredAtRunEnd = answered;
        },
        { replay },
      );
      expect(answeredAtRunEnd).toBe(true);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("A `ctx.net` route that awaits a `ctx.clock.after` of the run: `run()` resolves once the route has answered, with the run's clock stepped to the deadline", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 10_000 }), async (ms) => {
      let answered = false;
      let seen: { answered: boolean; now: number } | undefined;
      await simulate(
        async ({ ctx, run }) => {
          ctx.net.route(`${URL_BASE}*`, async () => {
            await ctx.clock.after(ms, new AbortController().signal);
            answered = true;
            return new Response("after");
          });
          void ctx.net.fetch(new Request(URL_BASE));
          await run();
          seen = { answered, now: ctx.clock.now() };
        },
        { replay },
      );
      expect(seen?.answered).toBe(true);
      expect(seen?.now).toBeGreaterThanOrEqual(ms);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
