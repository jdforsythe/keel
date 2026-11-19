import type { InputOf, JobTable } from "@keel/std-jobs";

/**
 * One schedule (std.schedules): a five-field `cron` read in `zone` (a `temporal.TimeZone`, default `UTC`), the `job`
 * of the queue it enqueues with that job's `input`, and what a restart does with missed fire times (`once`, default).
 */
export type ScheduleEntry<T extends JobTable> = {
  [K in keyof T & string]: {
    readonly cron: string;
    readonly zone?: string;
    readonly job: K;
    readonly input: InputOf<T[K]>;
    readonly missed?: "once" | "skip";
  };
}[keyof T & string];
