import { queue } from "@keel/std-jobs";
import { removal } from "./removal.server.ts";

/** The `api` module's job queue (std.jobs): the step, wake and forget jobs of `removal`. */
export const jobs = queue({ ...removal.jobs });
