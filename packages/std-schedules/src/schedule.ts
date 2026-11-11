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
 * `cron` or `zone` that does not parse, naming the field.
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
    if (why !== undefined || typeof cron === "string") throw new Error(`E2551 schedule ${id}: ${why}`);
    plan.push({ id, cron, zone, job: e.job, input: e.input, once: e.missed !== "skip" });
  }
  const module = Object.keys(table)[0]?.split(".")[0] ?? "";
  return { run: (ctx, signal) => runSchedule(ctx, signal, module, queue, plan) };
}
