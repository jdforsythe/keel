// The `api` module's runners in the app these tests boot (std.workflows Run, std.jobs E2504): its queue and the
// `flows` runner over the workflow a test declares.
import type { Runner } from "@keel/server";
import { type FlowQueue, flows } from "@keel/std-workflows";

/** The `api` module's runners: `jobs`, then `flows` over `wf` enqueuing into it. */
export const runnersOf = (jobs: FlowQueue & Runner, wf: Parameters<typeof flows>[1][number]): Runner[] => [
  jobs,
  flows(jobs, [wf]),
];
