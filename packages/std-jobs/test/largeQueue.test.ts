// std.jobs Run: due jobs start in `at`, then `id` order; between jobs the runner waits for the next `at`. A queue
// holding more pending jobs than a call takes arguments still finds that next `at`. Seed 1337
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { expect, test } from "vitest";
import { job, queue } from "../src/index.ts";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

test("A due job runs while 200,000 later jobs wait in the queue", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const ran: number[] = [];
  const jobs = queue({
    "orders.work": job({ input: s.object({ n: s.int() }) }, async ({ n }) => {
      ran.push(n);
      return ok(null);
    }),
  });
  const later = Array.from({ length: 200_000 }, (_, i) => ({
    id: `later-${i}`,
    job: "orders.work",
    input: { n: i + 1 },
    at: 60_000 + i,
    n: 0,
    l: 0,
  }));
  const due = { id: "due", job: "orders.work", input: { n: 0 }, at: 0, n: 0, l: 0 };
  await ctx.storage.set("std.jobs.orders", JSON.stringify({ q: [due, ...later], done: [], failed: [] }));
  const stop = new AbortController();
  const run = jobs.run(ctx, stop.signal);
  for (let i = 0; i < 20 && ran.length === 0; i++) await settle();
  stop.abort();
  await run;
  expect(ran).toEqual([0]);
}, 60_000);
