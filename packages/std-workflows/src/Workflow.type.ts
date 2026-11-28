import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";
import type { Job } from "@keel/std-jobs";
import type { WorkflowStores } from "./WorkflowStores.ts";
import type { FlowInput } from "./internal/FlowInput.schema.ts";
import type { Scan } from "./internal/Scan.ts";
import type { planKey } from "./internal/planKey.ts";

/**
 * A declared workflow (std.workflows): its store `id`, the `stores` factory an action lists to start instances and
 * send events, and `jobs`, the std.jobs table its module's `queue` spreads in. `flows` runs it.
 */
export type Workflow<D, Ev extends Readonly<Record<string, Schema<unknown>>>, S extends string> = {
  readonly id: string;
  readonly stores: (ctx: Ctx) => WorkflowStores<D, Ev, S>;
  readonly jobs: Readonly<Record<string, Job<FlowInput>>>;
  readonly [planKey]: (ctx: Ctx) => Promise<Scan | undefined>;
};
