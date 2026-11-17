// Spec: std.schedules, clause "With no mark, a first fire whose `enqueue` errs rejects `run`; started again after that fire time, `'once'` enqueues exactly one job for it, with key `<id>@<t>`." (rfc:0113)
// Seed 1337 (no random inputs; the scenario is fixed)
// Assumption: a fire is observed by spying `jobs.enqueue`; the key suffix `<t>` is accepted as epoch milliseconds or as the `Instant` text.
import { createCtx } from "@keel/ctx";
import { err, ok, s } from "@keel/schema";
import { job, queue } from "@keel/std-jobs";
import { schedule } from "@keel/std-schedules";
import { expect, test, vi } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const MIN = 60_000;
const T0259 = Date.parse("2026-11-10T02:59:00.000Z");
const T0300 = Date.parse("2026-11-10T03:00:00.000Z");

test("With no mark, a first fire whose `enqueue` errs rejects `run`; started again after that fire time, `'once'` enqueues exactly one job for it, with key `<id>@<t>`.", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const ran: number[] = [];
  const digest = job({ input: s.object({}) }, async () => {
    ran.push(ctx.clock.now());
    return ok(null);
  });
  const jobs = queue({ "orders.digest": digest });
  const table = {
    "orders.nightly": { cron: "0 3 * * *", zone: "UTC", job: "orders.digest", input: {}, missed: "once" },
  } as const;
  const orig = jobs.enqueue.bind(jobs);
  const keys: (string | undefined)[] = [];
  const spy = vi
    .spyOn(jobs, "enqueue")
    .mockImplementationOnce(async () => err({ code: "keel.busy", message: "busy", data: null }));
  ctx.clock.advance(T0259);
  const a = new AbortController();
  const first = schedule(jobs, table)
    .run(ctx, a.signal)
    .then(
      () => "resolved",
      () => "rejected",
    );
  await settle();
  ctx.clock.advance(MIN);
  await settle();
  expect(await first).toBe("rejected");
  expect(spy).toHaveBeenCalledTimes(1);

  spy.mockImplementation((c, id, input, opts) => {
    keys.push(opts?.key);
    return orig(c, id, input, opts);
  });
  ctx.clock.advance(30 * MIN);
  const b = new AbortController();
  const second = schedule(jobs, table).run(ctx, b.signal);
  const worker = jobs.run(ctx, b.signal);
  await settle();
  ctx.clock.advance(10 * MIN);
  await settle();
  expect(keys.length).toBe(1);
  expect([`orders.nightly@${T0300}`, `orders.nightly@${new Date(T0300).toISOString()}`]).toContain(keys[0]);
  expect(ran.length).toBe(1);
  b.abort();
  await second.catch(() => undefined);
  await worker.catch(() => undefined);
  vi.restoreAllMocks();
});
