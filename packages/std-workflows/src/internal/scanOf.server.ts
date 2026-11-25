import type { Ctx } from "@keel/ctx";
import { ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import type { Model } from "./Model.ts";
import type { Plan } from "./Plan.ts";
import type { Scan } from "./Scan.ts";

/**
 * Read a workflow store once (std.workflows Run) and list a job per instance: `<id>.<state>` in a step state, `<id>.wake`
 * after `ms` in a wait state, `<id>.forget` after `keepMs` in a final state, each keyed `<id>:<flow>:<entered>`.
 */
export function scanOf<S extends string, D>(m: Model<S, D>): (ctx: Ctx) => Promise<Scan | undefined> {
  return async (ctx) => {
    const r = await commitStores(ctx, m.open, (S) => ok(S.store.get("instances")));
    if (!r.ok) return undefined;
    const plans: Plan[] = [];
    const counts: Record<string, number> = {};
    for (const [id, row] of Object.entries(r.value)) {
      counts[row.state] = (counts[row.state] ?? 0) + 1;
      const wait = m.waits.get(row.state);
      const at: readonly [string, number] | undefined = m.steps.has(row.state)
        ? [row.state, 0]
        : wait !== undefined
          ? ["wake", wait.ms]
          : m.finals.has(row.state)
            ? ["forget", m.keepMs]
            : undefined;
      if (at !== undefined)
        plans.push({
          job: `${m.id}.${at[0]}`,
          input: { id, entered: row.entered },
          key: `${id}:${m.id}:${row.entered}`,
          delayMs: at[1],
        });
    }
    return { plans, counts };
  };
}
