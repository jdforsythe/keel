// std.schedules Restart: an entry without a mark stores the start time as its mark before it waits. Seed 1337
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { job, queue } from "@keel/std-jobs";
import { expect, test } from "vitest";
import { schedule } from "../src/index.ts";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const START = Date.parse("2026-11-10T02:59:00.000Z");

test("A start without marks writes the start time for every entry", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const jobs = queue({ "orders.digest": job({ input: s.object({}) }, async () => ok(null)) });
  const table = {
    "orders.a": { cron: "0 3 * * *", zone: "UTC", job: "orders.digest", input: {} },
    "orders.b": { cron: "5 3 * * *", zone: "UTC", job: "orders.digest", input: {} },
  } as const;
  ctx.clock.advance(START);
  const a = new AbortController();
  const run = schedule(jobs, table).run(ctx, a.signal);
  await settle();
  const stored = await ctx.storage.get("std.schedules.orders");
  expect(stored === null ? null : JSON.parse(stored)).toEqual({ "orders.a": START, "orders.b": START });
  a.abort();
  await run;
});
