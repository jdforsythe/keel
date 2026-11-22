import { flows } from "@keel/std-workflows";
import { jobs } from "./jobs.server.ts";
import { restock } from "./restock.server.ts";
import { schedules } from "./schedules.server.ts";

/** The shopping module's background work (k.topology Runners): its job queue, the weekly runs and their schedule. */
export const runners = [jobs, flows(jobs, [restock]), schedules];
