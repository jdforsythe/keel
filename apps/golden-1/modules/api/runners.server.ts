import { monitor } from "@keel/std-sessions/monitor";
import { flows } from "@keel/std-workflows";
import { jobs } from "./jobs.server.ts";
import { removal } from "./removal.server.ts";

/**
 * The `api` module's background work (k.topology Runners): `monitor` counts each `api.*` commit into `sessions.tally`;
 * `jobs` runs the removal jobs that `flows` enqueues for each `api.removal` instance.
 */
export const runners = [monitor, jobs, flows(jobs, [removal])];
