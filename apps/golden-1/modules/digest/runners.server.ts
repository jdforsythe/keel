import { jobs } from "./jobs.server.ts";
import { schedules } from "./schedules.server.ts";

/** The `digest` module's background work (k.topology Runners): its job queue and its hourly schedule. */
export const runners = [jobs, schedules];
