import { s } from "@keel/schema";

/** Per-name call statistics of one ctx (std.timings): count and summed, largest and latest durations in ms. */
export const Timings = s.record(
  s.object(
    {
      count: s.int({ min: 1 }),
      totalMs: s.number({ min: 0 }),
      maxMs: s.number({ min: 0 }),
      lastMs: s.number({ min: 0 }),
    },
    { closed: true },
  ),
);
export type Timings = s.infer<typeof Timings>;
