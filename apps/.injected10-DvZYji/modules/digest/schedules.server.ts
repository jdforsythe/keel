import { schedule } from "@keel/std-schedules";
import { jobs } from "./jobs.server.ts";

/** Recount the board at the start of every hour, UTC. */
export const schedules = schedule(jobs, {
  "digest.hourly": { cron: "0 * * * *", zone: "UTC", job: "digest.recount", input: {} },
});
