// Spec: std.schedules, clause "`30 2 * * *` in `Europe/Berlin` fires at 03:00 local on 2027-03-28 and once at the first 02:30 on 2026-10-25."
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

const cfg = { cron: "30 2 * * *", zone: "Europe/Berlin", job: "orders.digest", input: {} } as const;

test.skip("`30 2 * * *` in `Europe/Berlin` fires at 03:00 local on 2027-03-28 (01:00Z), the first minute after the gap, and not earlier.", async () => {
  const { ctx, jobs, fires } = fixture();
  const schedules = schedule(jobs, { "orders.berlin": cfg });
  ctx.clock.advance(Date.parse("2027-03-27T12:00:00.000Z"));
  const ac = new AbortController();
  const running = schedules.run(ctx, ac.signal);
  await settle();
  // 12:00Z on the 27th is after that day's 02:30 local, so the first fire ahead is on the 28th.
  ctx.clock.advance(Date.parse("2027-03-28T00:59:00.000Z") - ctx.clock.now());
  await settle();
  expect(fires.length).toBe(0);
  ctx.clock.advance(MIN);
  await settle();
  expect(fires.map((f) => f.at)).toEqual([Date.parse("2027-03-28T01:00:00.000Z")]);
  expect(keyIs(fires[0]?.key, "orders.berlin", Date.parse("2027-03-28T01:00:00.000Z"))).toBe(true);
  await stop(running, ac);
});

test.skip("`30 2 * * *` in `Europe/Berlin` fires once at the first 02:30 on 2026-10-25 (00:30Z), not again at the repeated 02:30 (01:30Z).", async () => {
  const { ctx, jobs, fires } = fixture();
  const schedules = schedule(jobs, { "orders.berlin": cfg });
  ctx.clock.advance(Date.parse("2026-10-24T12:00:00.000Z"));
  const ac = new AbortController();
  const running = schedules.run(ctx, ac.signal);
  await settle();
  ctx.clock.advance(Date.parse("2026-10-25T00:29:00.000Z") - ctx.clock.now());
  await settle();
  expect(fires.length).toBe(0);
  ctx.clock.advance(MIN);
  await settle();
  expect(fires.length).toBe(1);
  expect(fires[0]?.at).toBe(Date.parse("2026-10-25T00:30:00.000Z"));
  ctx.clock.advance(Date.parse("2026-10-25T02:30:00.000Z") - ctx.clock.now());
  await settle();
  expect(fires.length).toBe(1);
  // the next fire is 2026-10-26 02:30 local = 01:30Z
  ctx.clock.advance(Date.parse("2026-10-26T01:30:00.000Z") - ctx.clock.now());
  await settle();
  expect(fires.map((f) => f.at)).toEqual([
    Date.parse("2026-10-25T00:30:00.000Z"),
    Date.parse("2026-10-26T01:30:00.000Z"),
  ]);
  await stop(running, ac);
});
