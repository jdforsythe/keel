// std.schedules Run: "The key makes a fire time enqueue at most one job (std.jobs), also when a crash falls between the
// two steps." Each fire time's job runs once. Seed 1337
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { job, queue } from "@keel/std-jobs";
import { expect, test, vi } from "vitest";
import { schedule } from "../src/index.ts";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const MIN = 60_000;
const T10 = Date.parse("2026-11-10T10:00:00.000Z");

test("A crash after the enqueue and before the mark gives one job run per fire time", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const ran: string[] = [];
  const jobs = queue({
    "orders.digest": job({ input: s.object({ at: s.string() }) }, async (input) => {
      ran.push(input.at);
      return ok(null);
    }),
  });
  const table = {
    "orders.hourly": { cron: "0 * * * *", zone: "UTC", job: "orders.digest", input: { at: "x" } },
  } as const;
  const keys: (string | undefined)[] = [];
  const orig = jobs.enqueue.bind(jobs);
  vi.spyOn(jobs, "enqueue").mockImplementation((c, id, input, opts) => {
    keys.push(opts?.key);
    return orig(c, id, { at: String(opts?.key) }, opts);
  });
  ctx.clock.advance(T10 - 30 * MIN);
  const a = new AbortController();
  const first = schedule(jobs, table).run(ctx, a.signal);
  await settle();
  ctx.clock.advance(30 * MIN);
  await settle();
  a.abort();
  await first;
  const set = ctx.storage.set.bind(ctx.storage);
  const spy = vi
    .spyOn(ctx.storage, "set")
    .mockImplementation((k, v) => (k.startsWith("std.schedules.") ? Promise.reject(new Error("crash")) : set(k, v)));
  ctx.clock.advance(30 * MIN);
  const b = new AbortController();
  await settle();
  const second = schedule(jobs, table).run(ctx, b.signal);
  ctx.clock.advance(30 * MIN);
  await expect(second).rejects.toThrow("crash");
  spy.mockRestore();
  ctx.clock.advance(30 * MIN);
  const c = new AbortController();
  const third = schedule(jobs, table).run(ctx, c.signal);
  const d = new AbortController();
  const worker = jobs.run(ctx, d.signal);
  await settle();
  ctx.clock.advance(10 * MIN);
  await settle();
  const at10 = `orders.hourly@${T10}`;
  const at11 = `orders.hourly@${T10 + 60 * MIN}`;
  expect(keys).toEqual([at10, at11, at11]);
  expect(ran.sort()).toEqual([at10, at11]);
  c.abort();
  d.abort();
  await Promise.all([third, worker]);
});
