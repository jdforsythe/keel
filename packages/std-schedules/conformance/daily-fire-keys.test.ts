// Spec: std.schedules, clause "With `0 3 * * *` in `UTC` and the sim clock at 2026-11-10T02:59Z, one job is enqueued at 03:00Z and the next 24 h later, each with key `<id>@<t>`."
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

test.skip("With `0 3 * * *` in `UTC` and the sim clock at 2026-11-10T02:59Z, one job is enqueued at 03:00Z and the next 24 h later, each with key `<id>@<t>`.", async () => {
  const { ctx, jobs, fires } = fixture();
  const schedules = schedule(jobs, {
    "orders.nightly": { cron: "0 3 * * *", zone: "UTC", job: "orders.digest", input: {} },
  });
  const t0 = Date.parse("2026-11-10T03:00:00.000Z");
  ctx.clock.advance(t0 - MIN);
  const ac = new AbortController();
  const running = schedules.run(ctx, ac.signal);
  await settle();
  ctx.clock.advance(MIN - 1);
  await settle();
  expect(fires.length).toBe(0);
  ctx.clock.advance(1);
  await settle();
  expect(fires.length).toBe(1);
  expect(fires[0]?.at).toBe(t0);
  expect(keyIs(fires[0]?.key, "orders.nightly", t0)).toBe(true);
  ctx.clock.advance(86_400_000 - 1);
  await settle();
  expect(fires.length).toBe(1);
  ctx.clock.advance(1);
  await settle();
  expect(fires.length).toBe(2);
  expect(fires[1]?.at).toBe(t0 + 86_400_000);
  expect(keyIs(fires[1]?.key, "orders.nightly", t0 + 86_400_000)).toBe(true);
  await stop(running, ac);
});

test.skip("Each fire time of a generated daily `M H * * *` in `UTC` enqueues one job with key `<id>@<t>`, and the keys of successive fires differ.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 59 }), fc.integer({ min: 0, max: 23 }), async (m, h) => {
      const { ctx, jobs, fires } = fixture();
      const schedules = schedule(jobs, {
        "orders.daily": { cron: `${m} ${h} * * *`, zone: "UTC", job: "orders.digest", input: {} },
      });
      const start = Date.parse("2026-11-10T00:00:00.000Z") + 1;
      ctx.clock.advance(start);
      const ac = new AbortController();
      const running = schedules.run(ctx, ac.signal);
      await settle();
      const first = Date.parse("2026-11-10T00:00:00.000Z") + (h * 60 + m) * MIN;
      const expected = first > start ? first : first + 86_400_000;
      ctx.clock.advance(expected - start);
      await settle();
      ctx.clock.advance(86_400_000);
      await settle();
      expect(fires.map((f) => f.at)).toEqual([expected, expected + 86_400_000]);
      expect(keyIs(fires[0]?.key, "orders.daily", expected)).toBe(true);
      expect(keyIs(fires[1]?.key, "orders.daily", expected + 86_400_000)).toBe(true);
      expect(fires[0]?.key).not.toBe(fires[1]?.key);
      await stop(running, ac);
    }),
    { seed: 1337, numRuns: 15 },
  );
});
