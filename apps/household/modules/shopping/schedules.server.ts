import { schedule } from "@keel/std-schedules";
import { jobs } from "./jobs.server.ts";

/** Saturday at 08:00 UTC the staples go back on the list; a server down at that time starts the run once it is back. */
export const schedules = schedule(jobs, {
  "shopping.weekly": { cron: "0 8 * * 6", zone: "UTC", job: "shopping.startRestock", input: {}, missed: "once" },
});
