import type { Runner } from "@keel/server";
import type { FlowQueue } from "./FlowQueue.ts";
import type { Planned } from "./internal/Planned.ts";
import { runFlows } from "./internal/runFlows.server.ts";

/**
 * The runner of `workflows` (std.workflows Run, k.topology), listed in `runners.server.ts` beside `queue`: at start,
 * after each save of a workflow store and every 60,000 ms it enqueues each instance's step, wake or forget job into
 * `queue`, keyed `<id>:<flow>:<entered>` so a repeat enqueues nothing.
 */
export function flows(queue: FlowQueue, workflows: readonly Planned[]): Runner {
  return { run: (ctx, signal) => runFlows(ctx, signal, queue, workflows) };
}
