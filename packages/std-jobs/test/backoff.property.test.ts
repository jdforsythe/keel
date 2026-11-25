// std.jobs Run: a failed run waits `min(1000 * 2^(attempt-1), 3600000)` ms on `ctx.clock`. Seed 1337
import { createCtx } from "@keel/ctx";
import { err, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { job, queue } from "../src/index.ts";
import { backoff } from "../src/internal/backoff.ts";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

test("backoff doubles from 1,000 ms and is capped at 3,600,000 ms", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 60 }), (n) => {
      expect(backoff(n)).toBe(Math.min(1000 * 2 ** (n - 1), 3_600_000));
      expect(backoff(n + 1)).toBe(Math.min(backoff(n) * 2, 3_600_000));
      expect(backoff(n)).toBeLessThanOrEqual(3_600_000);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("For generated attempts and clock steps, an always-failing job runs `attempts` times at the backoff gaps, then fails once", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 7 }), fc.constantFrom(250, 500, 1000), async (attempts, step) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const at: number[] = [];
      const work = job({ input: s.object({}), attempts }, async () => {
        at.push(ctx.clock.now());
        return err({ code: "orders.down", message: "down", data: {} });
      });
      const jobs = queue({ "orders.work": work });
      const ac = new AbortController();
      const running = jobs.run(ctx, ac.signal);
      void (await jobs.enqueue(ctx, "orders.work", {}));
      await settle();
      for (let t = 0; t < 140_000; t += step) {
        ctx.clock.advance(step);
        await settle();
      }
      expect(at.length).toBe(attempts);
      at.forEach((t, k) => expect(t - (at[k - 1] ?? t)).toBe(k === 0 ? 0 : backoff(k)));
      const stored: unknown = JSON.parse((await ctx.storage.get("std.jobs.orders")) ?? "null");
      expect(stored).toMatchObject({ q: [], failed: [{ job: "orders.work", code: "orders.down" }] });
      ac.abort();
      await running;
    }),
    { seed: 1337, numRuns: 20 },
  );
});
