// Spec: std.jobs, clause "A job returning `err` twice then `ok` with `attempts: 3` runs at 0, 1,000 and 3,000 ms; with `attempts: 2` it ends in `failed` with its code and no input."
// std.jobs, run: an `err` waits `min(1000 * 2^(attempt-1), 3600000)` ms on `ctx.clock`; after `attempts` the job moves to `failed`.
// Seed 1337
// Assumption: `createApp` needs no `routes` for a deployable whose module only has runners (`@keel/router` is not a dependency of this package).
// Assumption: `failed` is read from the `jobs.queue` inspector section (dev `/__keel/inspect`), an object holding `failed: { id, job, code, at }[]`.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { job, queue } from "@keel/std-jobs";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const delay = (attempt: number) => Math.min(1000 * 2 ** (attempt - 1), 3_600_000);
const boom = () => err({ code: "orders.boom", message: "boom", data: {} });
const input = s.object({ secretish: s.string() });

async function runCalls(attempts: number, okOn: number, horizonMs: number, step: number): Promise<number[]> {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const calls: number[] = [];
  const work = job({ input, attempts }, async () => {
    calls.push(ctx.clock.now());
    return calls.length >= okOn ? ok(null) : boom();
  });
  const jobs = queue({ "orders.work": work });
  const ac = new AbortController();
  const running = jobs.run(ctx, ac.signal);
  await jobs.enqueue(ctx, "orders.work", { secretish: "x" });
  await settle();
  for (let t = 0; t < horizonMs; t += step) {
    ctx.clock.advance(step);
    await settle();
  }
  ac.abort();
  await running.catch(() => undefined);
  return calls;
}

test("A job returning `err` twice then `ok` with `attempts: 3` runs at 0, 1,000 and 3,000 ms.", async () => {
  expect(await runCalls(3, 3, 10_000, 1000)).toEqual([0, 1000, 3000]);
});

test("With `attempts: 2` a job returning `err` ends in `failed` with its code and no input.", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const work = job({ input, attempts: 2 }, async () => boom());
  const jobs = queue({ "orders.work": work });
  const app = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    ctx,
    mode: "dev",
    runners: { orders: [jobs] },
  });
  await jobs.enqueue(ctx, "orders.work", { secretish: "needle-4711" });
  await settle();
  for (let i = 0; i < 4; i++) {
    ctx.clock.advance(1000);
    await settle();
  }
  const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
  const text = await res.text();
  expect(text).toContain("orders.boom");
  expect(text).toContain("orders.work");
  expect(text).not.toContain("needle-4711");
  expect(text).not.toContain("secretish");
});

test("For generated `attempts`, an always-`err` job runs at times whose gaps are `min(1000 * 2^(attempt-1), 3600000)` ms, exactly `attempts` times.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (attempts) => {
      const calls = await runCalls(attempts, Number.POSITIVE_INFINITY, 70_000, 1000);
      expect(calls.length).toBe(attempts);
      expect(calls[0]).toBe(0);
      for (let k = 1; k < calls.length; k++) expect((calls[k] ?? 0) - (calls[k - 1] ?? 0)).toBe(delay(k));
    }),
    { seed: 1337, numRuns: 12 },
  );
});

test("The backoff wait is capped at 3,600,000 ms (the wait after attempt 13 is 3,600,000, not 4,096,000).", async () => {
  const calls = await runCalls(14, Number.POSITIVE_INFINITY, 8_000_000, 1000);
  expect(calls.length).toBe(14);
  expect((calls[12] ?? 0) - (calls[11] ?? 0)).toBe(2_048_000);
  expect((calls[13] ?? 0) - (calls[12] ?? 0)).toBe(3_600_000);
});
