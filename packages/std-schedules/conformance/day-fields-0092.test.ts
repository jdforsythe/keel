// Spec: std.schedules, clause "`0 0 */2 * 1` fires on Mondays that are odd days of the month and on no other day." (rfc:0092 A6)
// Spec: std.schedules, API: "A day field not starting with `*` is restricted; when both are, a day matching either matches, else both must match."
// Seed 1337
// Assumption: a fire is observed by spying `jobs.enqueue`, as in next-fire-matches-cron.test.ts; the oracle reads UTC calendar days with `Date`'s UTC getters on a given instant (no clock reads).
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { job, queue } from "@keel/std-jobs";
import { schedule } from "@keel/std-schedules";
import fc from "fast-check";
import { expect, test, vi } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const MIN = 60_000;
const DAY = 86_400_000;

function fixture() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const digest = job({ input: s.object({}) }, async () => ok(null));
  const jobs = queue({ "orders.digest": digest });
  const fires: number[] = [];
  const orig = jobs.enqueue.bind(jobs);
  vi.spyOn(jobs, "enqueue").mockImplementation((c, id, input, opts) => {
    fires.push(ctx.clock.now());
    return orig(c, id, input, opts);
  });
  return { ctx, jobs, fires };
}

// Next midnight (UTC) strictly after t where `ok(dayOfMonth, dayOfWeek)` holds.
const utcDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" });
// Day of month and weekday (Sunday 0) of an instant; 1970-01-01 (day 0) was a Thursday (4).
const calendarOf = (ms: number): { dom: number; dow: number } => ({
  dom: Number(utcDay.format(ms)),
  dow: (Math.floor(ms / DAY) + 4) % 7,
});

const nextMidnight = (t: number, pass: (dom: number, dow: number) => boolean): number => {
  for (let d = Math.floor(t / DAY) + 1; d < Math.floor(t / DAY) + 800; d++) {
    const { dom, dow } = calendarOf(d * DAY);
    if (pass(dom, dow)) return d * DAY;
  }
  throw new Error("fixture: no matching day within 800 days");
};

// First fire of `cron` after `t`, found by jumping to one minute short of `expected`, then to it.
async function firesAround(cron: string, t: number, expected: number): Promise<{ early: number; at: number[] }> {
  const { ctx, jobs, fires } = fixture();
  const schedules = schedule(jobs, { "orders.x": { cron, zone: "UTC", job: "orders.digest", input: {} } });
  ctx.clock.advance(t);
  const ac = new AbortController();
  const running = schedules.run(ctx, ac.signal);
  await settle();
  if (expected - MIN >= t) ctx.clock.advance(expected - MIN - t);
  await settle();
  const early = fires.length;
  ctx.clock.advance(expected - ctx.clock.now());
  await settle();
  ac.abort();
  await running.catch(() => undefined);
  return { early, at: [...fires] };
}

const instant = fc
  .tuple(
    fc.integer({ min: Date.UTC(2026, 0, 1) / DAY, max: Date.UTC(2028, 0, 1) / DAY }),
    fc.integer({ min: 0, max: DAY - 1 }),
  )
  .map(([day, off]) => day * DAY + off);

test("`0 0 */2 * 1` fires on Mondays that are odd days of the month and on no other day.", async () => {
  await fc.assert(
    fc.asyncProperty(instant, async (t) => {
      const expected = nextMidnight(t, (dom, dow) => dom % 2 === 1 && dow === 1);
      const { dom, dow } = calendarOf(expected);
      expect(dow).toBe(1);
      expect(dom % 2).toBe(1);
      const { early, at } = await firesAround("0 0 */2 * 1", t, expected);
      expect(early).toBe(0);
      expect(at).toEqual([expected]);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

const expandDay = (f: string, lo: number, hi: number): Set<number> => {
  const out = new Set<number>();
  for (const part of f.split(",")) {
    const [range = "", stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    let a = lo;
    let b = hi;
    if (range !== "*") {
      const [x = "", y] = range.split("-");
      a = Number(x);
      b = y === undefined ? a : Number(y);
    }
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
};
const domArb = fc.constantFrom("*", "*/2", "1", "1,15", "10-20", "5-25/5");
const dowArb = fc.constantFrom("*", "*/2", "1", "1,3", "2-4", "0");

test("A day field not starting with `*` is restricted; when both are, a day matching either matches, else both must match.", async () => {
  await fc.assert(
    fc.asyncProperty(domArb, dowArb, instant, async (dom, dow, t) => {
      const domSet = expandDay(dom, 1, 31);
      const dowSet = expandDay(dow, 0, 6);
      const domR = !dom.startsWith("*");
      const dowR = !dow.startsWith("*");
      const pass = (d: number, w: number): boolean =>
        domR && dowR ? domSet.has(d) || dowSet.has(w) : domSet.has(d) && dowSet.has(w);
      const expected = nextMidnight(t, pass);
      const { early, at } = await firesAround(`0 0 ${dom} * ${dow}`, t, expected);
      expect(early).toBe(0);
      expect(at).toEqual([expected]);
    }),
    { seed: 1337, numRuns: 25 },
  );
});
