import { secretPathOf } from "@keel/schema/internal";
import type { JobTable } from "./JobTable.ts";
import type { Queue } from "./Queue.type.ts";
import { enqueue } from "./internal/enqueue.ts";
import { runQueue } from "./internal/runQueue.ts";

/**
 * A module's job queue (std.jobs) in `modules/<id>/jobs.server.ts`, keyed by module-prefixed job ids; list it in the
 * module's `runners`. Throws E2503 when a job's input schema holds `s.secret`: a job's input is stored.
 */
export function queue<T extends JobTable>(table: T): Queue<T> {
  for (const [id, j] of Object.entries(table)) {
    const at = secretPathOf(j.input.node);
    if (at !== null)
      throw new Error(`E2503 job ${id} input holds s.secret at ${at || "(root)"}; a job's input is stored`);
  }
  const module = Object.keys(table)[0]?.split(".")[0] ?? "";
  return {
    table,
    enqueue: (ctx, id, input, opts) => enqueue(ctx, module, table, id, input, opts ?? {}),
    run: (ctx, signal) => runQueue(ctx, signal, module, table),
  };
}
