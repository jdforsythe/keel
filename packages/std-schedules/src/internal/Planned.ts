import type { Cron } from "./Cron.ts";

/** A schedule entry ready to run: its id, parsed cron, zone, job, input and missed policy. */
export type Planned = {
  readonly id: string;
  readonly cron: Cron;
  readonly zone: string;
  readonly job: string;
  readonly input: unknown;
  readonly once: boolean;
};
