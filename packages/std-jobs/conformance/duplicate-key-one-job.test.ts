// Spec: std.jobs, clause "Two `enqueue`s with one `key` return one id and run once, also when the second comes after the first finished."
// Seed 1337
import { createCtx } from "@keel/ctx";
import { job, queue } from "@keel/std-jobs";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const key = fc.stringMatching(/^[a-z0-9]{1,12}$/);

function fixture() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const ran: string[] = [];
  const work = job({ input: s.object({ k: s.string() }) }, async (input) => {
    ran.push(input.k);
    return ok(null);
  });
  return { ctx, ran, jobs: queue({ "orders.work": work }) };
}

test.skip("Two `enqueue`s with one `key` return one id and run once while the first is pending.", async () => {
  await fc.assert(
    fc.asyncProperty(key, async (k) => {
      const { ctx, ran, jobs } = fixture();
      const a = await jobs.enqueue(ctx, "orders.work", { k }, { key: k, delayMs: 100 });
      const b = await jobs.enqueue(ctx, "orders.work", { k }, { key: k, delayMs: 100 });
      expect(a.ok && b.ok).toBe(true);
      expect(a.ok && b.ok && a.value === b.value).toBe(true);
      const ac = new AbortController();
      const running = jobs.run(ctx, ac.signal);
      await settle();
      ctx.clock.advance(100);
      await settle();
      ctx.clock.advance(10_000);
      await settle();
      expect(ran).toEqual([k]);
      ac.abort();
      await running.catch(() => undefined);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test.skip("Two `enqueue`s with one `key` return one id and run once, also when the second comes after the first finished.", async () => {
  await fc.assert(
    fc.asyncProperty(key, fc.integer({ min: 1, max: 5 }), async (k, repeats) => {
      const { ctx, ran, jobs } = fixture();
      const ac = new AbortController();
      const running = jobs.run(ctx, ac.signal);
      const first = await jobs.enqueue(ctx, "orders.work", { k }, { key: k });
      await settle();
      expect(ran).toEqual([k]);
      for (let i = 0; i < repeats; i++) {
        const again = await jobs.enqueue(ctx, "orders.work", { k }, { key: k });
        expect(again).toEqual(first);
        await settle();
        ctx.clock.advance(5000);
        await settle();
      }
      expect(ran).toEqual([k]);
      ac.abort();
      await running.catch(() => undefined);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test.skip("Enqueues with distinct keys return distinct ids and each runs once.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.uniqueArray(key, { minLength: 2, maxLength: 6 }), async (keys) => {
      const { ctx, ran, jobs } = fixture();
      const ids = new Set<unknown>();
      for (const k of keys) {
        const r = await jobs.enqueue(ctx, "orders.work", { k }, { key: k });
        expect(r.ok).toBe(true);
        if (r.ok) ids.add(r.value);
      }
      expect(ids.size).toBe(keys.length);
      const ac = new AbortController();
      const running = jobs.run(ctx, ac.signal);
      await settle();
      expect([...ran].sort()).toEqual([...keys].sort());
      ac.abort();
      await running.catch(() => undefined);
    }),
    { seed: 1337, numRuns: 20 },
  );
});
