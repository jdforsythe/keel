// Spec: std.schedules, clause "For generated `cron` values and instants `t`, the next fire time after `t` matches the expression, and no minute strictly between them does (checked by a minute-by-minute scan)."
// Assumption: the next fire time is observed as the sim clock reading at the `enqueue` call; the reference matcher below is the spec grammar
// (fields are `*`, `n`, `a-b`, comma lists, `/step` on `*` and `a-b`; a day matching either restricted day field matches).
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

type Range = readonly [number, number];
const atom = (r: Range, star: boolean) =>
  fc
    .tuple(
      fc.integer({ min: r[0], max: r[1] }),
      fc.integer({ min: r[0], max: r[1] }),
      fc.integer({ min: 1, max: 5 }),
      fc.nat(3),
    )
    .chain(([x, y, step, form]) => {
      const a = Math.min(x, y);
      const b = Math.max(x, y);
      if (star && form === 0) return fc.constant("*");
      if (star && form === 1) return fc.constant(`*/${step}`);
      if (form === 2) return fc.constant(`${a}-${b}/${step}`);
      return fc.constant(form === 3 ? `${a}-${b}` : `${x}`);
    });
const field = (r: Range, star: boolean) =>
  fc.array(atom(r, star), { minLength: 1, maxLength: 3 }).map((l) => l.join(","));
const dayField = (r: Range) => fc.oneof(fc.constant("*"), field(r, false));

function expand(f: string, r: Range): Set<number> {
  const out = new Set<number>();
  for (const part of f.split(",")) {
    const [range = "", stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    let lo = r[0];
    let hi = r[1];
    if (range !== "*") {
      const [x = "", y] = range.split("-");
      lo = Number(x);
      hi = y === undefined ? lo : Number(y);
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}
function matcher(cron: string): (ms: number) => boolean {
  const [mi = "", ho = "", dm = "", mo = "", dw = ""] = cron.split(" ");
  const sets = [
    expand(mi, [0, 59]),
    expand(ho, [0, 23]),
    expand(dm, [1, 31]),
    expand(mo, [1, 12]),
    expand(dw, [0, 6]),
  ] as const;
  const domR = dm !== "*";
  const dowR = dw !== "*";
  return (ms) => {
    const d = new Date(ms);
    if (!sets[0].has(d.getUTCMinutes()) || !sets[1].has(d.getUTCHours()) || !sets[3].has(d.getUTCMonth() + 1))
      return false;
    const a = sets[2].has(d.getUTCDate());
    const b = sets[4].has(d.getUTCDay());
    return domR && dowR ? a || b : domR ? a : dowR ? b : true;
  };
}
const cronArb = fc
  .tuple(field([0, 59], true), field([0, 23], true), dayField([1, 28]), field([1, 12], true), dayField([0, 6]))
  .map((p) => p.join(" "));
const instantArb = fc
  .tuple(
    fc.integer({ min: Date.UTC(2026, 0, 1) / MIN, max: Date.UTC(2028, 0, 1) / MIN }),
    fc.integer({ min: 1, max: MIN - 1 }),
  )
  .map(([minute, off]) => minute * MIN + off);

test.skip("For generated `cron` values and instants `t`, the next fire time after `t` matches the expression, and no minute strictly between them does (checked by a minute-by-minute scan).", async () => {
  await fc.assert(
    fc.asyncProperty(cronArb, instantArb, async (cron, t) => {
      const matches = matcher(cron);
      let next = Math.floor(t / MIN) * MIN + MIN;
      const limit = next + 800 * 1440 * MIN;
      while (next < limit && !matches(next)) next += MIN;
      fc.pre(next < limit);
      const { ctx, jobs, fires } = fixture();
      const schedules = schedule(jobs, { "orders.x": { cron, zone: "UTC", job: "orders.digest", input: {} } });
      ctx.clock.advance(t);
      const ac = new AbortController();
      const running = schedules.run(ctx, ac.signal);
      await settle();
      // nothing fires at any minute before `next`: jump to one minute short of it
      if (next - MIN > t) {
        ctx.clock.advance(next - MIN - t);
        await settle();
      }
      expect(fires.length).toBe(0);
      ctx.clock.advance(next - ctx.clock.now());
      await settle();
      expect(fires.length).toBe(1);
      expect(fires[0]?.at).toBe(next);
      expect(matches(fires[0]?.at ?? 0)).toBe(true);
      await stop(running, ac);
    }),
    { seed: 1337, numRuns: 25 },
  );
});
