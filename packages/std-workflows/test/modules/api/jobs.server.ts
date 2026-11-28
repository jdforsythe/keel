// The `api` module of the app these tests boot (std.jobs: one queue per module, in `modules/<id>/jobs.server.ts`,
// E2501). Each test declares its own workflow, so the queue is built from that workflow's `jobs`, spread in as an
// app's module spreads its workflows'.
import { type JobTable, type Queue, queue } from "@keel/std-jobs";

/** The `api` module's queue over the jobs of the workflow `wf`. */
export const jobsOf = <T extends JobTable>(wf: { readonly jobs: T }): Queue<T> => queue({ ...wf.jobs });
