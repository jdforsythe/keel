import { defect } from "@keel/schema";
import type { Runner } from "@keel/server";
import type { JobTable, Queue } from "@keel/std-jobs";
import type { ScheduleEntry } from "./ScheduleEntry.ts";
import type { Planned } from "./internal/Planned.ts";
import { entryError } from "./internal/entryError.ts";
import { parseCron } from "./internal/parseCron.ts";
import { runSchedule } from "./internal/runSchedule.ts";

/**
 * A module's schedules (std.schedules) in `modules/<id>/schedules.server.ts`, keyed by module-prefixed ids: a runner
 * that enqueues each entry's job on `queue` at its fire times. List it in the module's `runners`. Throws E2551 for a
 * `cron` or `zone` that does not parse, naming the field, and E2554 for a `job` absent from `queue`, a `job` of another
 * module, or an `input` its job's schema refuses.
 */
export function schedule<T extends JobTable>(
  queue: Queue<T>,
  table: Readonly<Record<string, ScheduleEntry<T>>>,
): Runner {
  const plan: Planned[] = [];
  for (const [id, e] of Object.entries(table)) {
    const zone = e.zone ?? "UTC";
    const why = entryError(e.cron, zone);
    const cron = parseCron(e.cron);
    if (why !== undefined || typeof cron === "string") defect(`schedule ${id}: ${why}`, "E2551");
    const mod = id.split(".")[0];
    const target = Object.hasOwn(queue.table, e.job) ? queue.table[e.job] : undefined;
    if (target === undefined)
      defect(`schedule ${id}: job '${String(e.job).slice(0, 40)}' is not in the queue`, "E2554");
    if (!String(e.job).startsWith(`${mod}.`))
      defect(`schedule ${id}: job '${String(e.job).slice(0, 40)}' belongs to another module`, "E2554");
    if (!target.input.parse(e.input).ok) defect(`schedule ${id}: input is refused by job '${e.job}'`, "E2554");
    plan.push({ id, cron, zone, job: e.job, input: e.input, once: e.missed !== "skip" });
  }
  const module = Object.keys(table)[0]?.split(".")[0] ?? "";
  return { run: (ctx, signal) => runSchedule(ctx, signal, module, queue, plan) };
}
