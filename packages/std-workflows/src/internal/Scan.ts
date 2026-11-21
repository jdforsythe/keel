import type { Plan } from "./Plan.ts";

/** What one read of a workflow store gives `flows`: the jobs to enqueue and a count per state. */
export type Scan = { readonly plans: readonly Plan[]; readonly counts: Readonly<Record<string, number>> };
