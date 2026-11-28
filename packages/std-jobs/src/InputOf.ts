import type { Job } from "./Job.type.ts";

/** The parsed input type of a job (std.jobs), which `enqueue` takes. */
export type InputOf<J> = J extends Job<infer I> ? I : never;
