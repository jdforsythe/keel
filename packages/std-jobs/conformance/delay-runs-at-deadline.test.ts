// Spec: std.jobs, clause "Under sim, a job enqueued with `delayMs: 500` runs when the clock reaches 500, not before, with the parsed input; `ok` removes it."
// Seed 1337
import { createCtx } from "@keel/ctx";
import { job, queue } from "@keel/std-jobs";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

test("Under sim, a job enqueued with `delayMs: 500` runs when the clock reaches 500, not before, with the parsed input; `ok` removes it.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 1, max: 5000 }), async (n, delay) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const seen: { at: number; input: unknown }[] = [];
      const work = job({ input: s.object({ n: s.number() }) }, async (input) => {
        seen.push({ at: ctx.clock.now(), input });
        return ok(null);
      });
      const jobs = queue({ "orders.work": work });
      const ac = new AbortController();
      const running = jobs.run(ctx, ac.signal);
      const id = await jobs.enqueue(ctx, "orders.work", { n }, { delayMs: delay });
      expect(id.ok).toBe(true);
      await settle();
      ctx.clock.advance(delay - 1);
      await settle();
      expect(seen.length).toBe(0);
      ctx.clock.advance(1);
      await settle();
      expect(seen).toEqual([{ at: delay, input: { n } }]);
      ctx.clock.advance(10_000_000);
      await settle();
      expect(seen.length).toBe(1);
      ac.abort();
      await running.catch(() => undefined);
    }),
    { seed: 1337, numRuns: 20 },
  );
});
