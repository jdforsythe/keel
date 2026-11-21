import type { Job } from "./Job.type.ts";

/** A module's jobs by module-prefixed id (std.jobs), the argument of `queue`. */
export type JobTable = Readonly<Record<string, Job<unknown>>>;
