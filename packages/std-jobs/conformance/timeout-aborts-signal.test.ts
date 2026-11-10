// Spec: std.jobs, clause "An `fn` not settled after `timeoutMs` sees its `signal` aborted, and the run counts as an attempt."
// Seed 1337
import { createCtx } from "@keel/ctx";
import { job, queue } from "@keel/std-jobs";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

test.skip("An `fn` not settled after `timeoutMs` sees its `signal` aborted, and the run counts as an attempt.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 20 }), async (units) => {
      const timeoutMs = units * 1000;
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const signals: AbortSignal[] = [];
      const starts: number[] = [];
      const work = job({ input: s.object({}), attempts: 2, timeoutMs }, (_input, _ctx, signal) => {
        signals.push(signal);
        starts.push(ctx.clock.now());
        return new Promise(() => undefined);
      });
      const jobs = queue({ "orders.work": work });
      const ac = new AbortController();
      const running = jobs.run(ctx, ac.signal);
      await jobs.enqueue(ctx, "orders.work", {});
      await settle();
      expect(signals.length).toBe(1);
      ctx.clock.advance(timeoutMs - 1);
      await settle();
      expect(signals[0]?.aborted).toBe(false);
      ctx.clock.advance(1);
      await settle();
      expect(signals[0]?.aborted).toBe(true);
      // the timed-out run counted as attempt 1: the retry waits 1,000 ms, then attempt 2 is the last
      ctx.clock.advance(1000);
      await settle();
      expect(starts).toEqual([0, timeoutMs + 1000]);
      ctx.clock.advance(timeoutMs + 100_000);
      await settle();
      expect(starts.length).toBe(2);
      ac.abort();
      await running.catch(() => undefined);
    }),
    { seed: 1337, numRuns: 15 },
  );
});

test.skip("A throwing `fn` counts as an attempt and is retried after the backoff.", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const starts: number[] = [];
  const work = job({ input: s.object({}), attempts: 3 }, async () => {
    starts.push(ctx.clock.now());
    throw new Error("boom");
  });
  const jobs = queue({ "orders.work": work });
  const ac = new AbortController();
  const running = jobs.run(ctx, ac.signal);
  await jobs.enqueue(ctx, "orders.work", {});
  for (let i = 0; i < 5; i++) {
    await settle();
    ctx.clock.advance(1000);
  }
  await settle();
  expect(starts).toEqual([0, 1000, 3000]);
  ac.abort();
  await running.catch(() => undefined);
});
