import type { Ctx } from "@keel/ctx";
import { s } from "@keel/schema";
import type { JobTable, Queue } from "@keel/std-jobs";
import type { Planned } from "./Planned.ts";
import { seek } from "./seek.ts";

const Marks = s.record(s.number());

/**
 * A schedule's runner (std.schedules Run, Restart). At start, an entry whose mark is older than its latest fire time
 * enqueues that one (`once`) or none (`skip`); an entry without a mark starts from now: before it waits, one write
 * stores the start time as the mark of every such entry, so a first fire whose `enqueue` errs has passed at the next start. At each fire time `t` it
 * enqueues `job` with key `<id>@<t>` (`t` in epoch ms), then, once `enqueue` returns `ok`, stores `t` as the
 * entry's mark under `std.schedules.<module>`; an `err` stores no mark and rejects. When `signal` aborts it stops waiting and resolves.
 */
export async function runSchedule(
  ctx: Ctx,
  signal: AbortSignal,
  module: string,
  queue: Queue<JobTable>,
  plan: readonly Planned[],
): Promise<void> {
  const key = `std.schedules.${module}`;
  const raw = await ctx.storage.get(key);
  const read = Marks.parse(raw === null ? {} : JSON.parse(raw));
  if (!read.ok) throw new Error(`std.schedules: ${key} does not hold schedule marks`);
  const marks = read.value;
  const fire = async (p: Planned, t: number): Promise<void> => {
    const r = await queue.enqueue(ctx, p.job, p.input, { key: `${p.id}@${t}` });
    if (!r.ok) throw new Error(`std.schedules: enqueue ${p.job} failed: ${r.error.code}`);
    marks[p.id] = t;
    await ctx.storage.set(key, JSON.stringify(marks));
  };
  const now = ctx.clock.now();
  const fresh = plan.filter((p) => marks[p.id] === undefined);
  const had = new Set(plan.filter((p) => marks[p.id] !== undefined));
  for (const p of fresh) marks[p.id] = now;
  if (fresh.length > 0) await ctx.storage.set(key, JSON.stringify(marks));
  const next = new Map<Planned, number | undefined>();
  for (const p of plan) {
    const mark = marks[p.id];
    const last = mark === undefined || !had.has(p) ? undefined : seek(p.cron, p.zone, now, -1);
    if (p.once && mark !== undefined && last !== undefined && last > mark) await fire(p, last);
    next.set(p, seek(p.cron, p.zone, now, 1));
  }
  while (!signal.aborted) {
    const t = Math.min(...[...next.values()].map((x) => x ?? Number.POSITIVE_INFINITY));
    try {
      await (t < Number.POSITIVE_INFINITY
        ? ctx.clock.after(Math.max(0, t - ctx.clock.now()), signal)
        : new Promise((_, reject) => signal.addEventListener("abort", reject, { once: true })));
    } catch {
      return;
    }
    if (ctx.clock.now() < t) continue;
    for (const [p, at] of next)
      if (at === t) {
        await fire(p, t);
        next.set(p, seek(p.cron, p.zone, t, 1));
      }
  }
}
