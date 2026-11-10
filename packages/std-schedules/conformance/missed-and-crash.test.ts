// Spec: std.schedules, clause "Closed across three fire times then started: `'once'` enqueues one job, for the latest; `'skip'` none; a crash after the enqueue and before the mark gives one job run."
// Seed 1337
// Assumption: a fire is observed by spying `jobs.enqueue` (the schedule calls `queue.enqueue(ctx, job, input, { key })`); the key suffix `<t>`
// is accepted as epoch milliseconds or as the `Instant` text of the fire minute.
import { createCtx } from "@keel/ctx";
import { job, queue } from "@keel/std-jobs";
import { schedule } from "@keel/std-schedules";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test, vi } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
type Fire = { key: string | undefined; at: number };
function fixture() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const ran: number[] = [];
  const digest = job({ input: s.object({}) }, async () => {
    ran.push(ctx.clock.now());
    return ok(null);
  });
  const jobs = queue({ "orders.digest": digest });
  const fires: Fire[] = [];
  const orig = jobs.enqueue.bind(jobs);
  vi.spyOn(jobs, "enqueue").mockImplementation((c, id, input, opts) => {
    fires.push({ key: opts?.key, at: ctx.clock.now() });
    return orig(c, id, input, opts);
  });
  return { ctx, jobs, fires, ran };
}
const keyIs = (key: string | undefined, id: string, ms: number) =>
  key === `${id}@${ms}` || key === `${id}@${new Date(ms).toISOString()}`;
async function stop(running: Promise<void>, ac: AbortController) {
  ac.abort();
  await running.catch(() => undefined);
}
const MIN = 60_000;

const HOUR = 3_600_000;
const T10 = Date.parse("2026-11-10T10:00:00.000Z");

// Runs the hourly entry across its 11:00 fire (mark 11:00), closes, moves the clock `hours` + 30 min on, and starts again.
async function reopen(missed: "once" | "skip", hours: number) {
  const f = fixture();
  const table = {
    "orders.hourly": { cron: "0 * * * *", zone: "UTC", job: "orders.digest", input: {}, missed },
  } as const;
  f.ctx.clock.advance(T10 + 30 * MIN);
  const first = new AbortController();
  const one = schedule(f.jobs, table).run(f.ctx, first.signal);
  await settle();
  f.ctx.clock.advance(30 * MIN);
  await settle();
  expect(f.fires.length).toBe(1);
  await stop(one, first);
  f.ctx.clock.advance(hours * HOUR + 30 * MIN);
  const second = new AbortController();
  const two = schedule(f.jobs, table).run(f.ctx, second.signal);
  await settle();
  return { ...f, stop: () => stop(two, second) };
}

test.skip("Closed across three fire times then started, `'once'` enqueues one job, for the latest.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 3, max: 30 }), async (hours) => {
      const f = await reopen("once", hours);
      expect(f.fires.length).toBe(2);
      const latest = T10 + HOUR + hours * HOUR;
      expect(keyIs(f.fires[1]?.key, "orders.hourly", latest)).toBe(true);
      await f.stop();
    }),
    { seed: 1337, numRuns: 15 },
  );
});

test.skip("Closed across three fire times then started, `'skip'` enqueues none.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 3, max: 30 }), async (hours) => {
      const f = await reopen("skip", hours);
      expect(f.fires.length).toBe(1);
      f.ctx.clock.advance(30 * MIN);
      await settle();
      expect(f.fires.length).toBe(2);
      await f.stop();
    }),
    { seed: 1337, numRuns: 15 },
  );
});

test.skip("A crash after the enqueue and before the mark gives one job run.", async () => {
  const f = fixture();
  const table = { "orders.hourly": { cron: "0 * * * *", zone: "UTC", job: "orders.digest", input: {} } } as const;
  f.ctx.clock.advance(T10 - 30 * MIN);
  const a = new AbortController();
  const first = schedule(f.jobs, table).run(f.ctx, a.signal);
  await settle();
  f.ctx.clock.advance(30 * MIN);
  await settle();
  expect(f.fires.length).toBe(1);
  await stop(first, a);
  // the 11:00 fire enqueues, then its mark write is lost
  const set = f.ctx.storage.set.bind(f.ctx.storage);
  const spy = vi
    .spyOn(f.ctx.storage, "set")
    .mockImplementation((k, v) => (k.startsWith("std.schedules.") ? Promise.reject(new Error("crash")) : set(k, v)));
  f.ctx.clock.advance(30 * MIN);
  const b = new AbortController();
  const second = schedule(f.jobs, table).run(f.ctx, b.signal);
  second.catch(() => undefined);
  await settle();
  f.ctx.clock.advance(30 * MIN);
  await settle();
  expect(f.fires.length).toBe(2);
  await stop(second, b);
  spy.mockRestore();
  // restart: the unmarked 11:00 fire is enqueued again under the same key and adds nothing
  f.ctx.clock.advance(30 * MIN);
  const c = new AbortController();
  const third = schedule(f.jobs, table).run(f.ctx, c.signal);
  const d = new AbortController();
  const worker = f.jobs.run(f.ctx, d.signal);
  await settle();
  f.ctx.clock.advance(10 * MIN);
  await settle();
  expect(f.fires[2]?.key).toBe(f.fires[1]?.key);
  expect(f.ran.length).toBe(1);
  await stop(third, c);
  await stop(worker, d);
});

test.skip("An entry without a mark starts from now: a fire time before the start enqueues nothing.", async () => {
  const f = fixture();
  const table = { "orders.hourly": { cron: "0 * * * *", zone: "UTC", job: "orders.digest", input: {} } } as const;
  f.ctx.clock.advance(T10 + 30 * MIN);
  const a = new AbortController();
  const running = schedule(f.jobs, table).run(f.ctx, a.signal);
  await settle();
  expect(f.fires.length).toBe(0);
  await stop(running, a);
});

test.skip("When `signal` aborts, the runner stops waiting: `run` settles and no later fire time enqueues.", async () => {
  const f = fixture();
  const table = { "orders.hourly": { cron: "0 * * * *", zone: "UTC", job: "orders.digest", input: {} } } as const;
  f.ctx.clock.advance(T10 + 30 * MIN);
  const a = new AbortController();
  const running = schedule(f.jobs, table).run(f.ctx, a.signal);
  await settle();
  a.abort();
  await expect(
    running.then(
      () => "settled",
      () => "settled",
    ),
  ).resolves.toBe("settled");
  f.ctx.clock.advance(5 * HOUR);
  await settle();
  expect(f.fires.length).toBe(0);
});
