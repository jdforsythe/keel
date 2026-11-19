import { s } from "@keel/schema";

/**
 * What `monitor` keeps under `ctx.storage` key `sessions.tally` and route `sessions.tally` returns (std.monitor):
 * commits per transaction name in `tx`, `from` the clock time of the first merge and `to` of the latest.
 */
export const Tally = s.object(
  { v: s.literal(1), from: s.number(), to: s.number(), tx: s.record(s.int({ min: 0 })) },
  { closed: true },
);
export type Tally = s.infer<typeof Tally>;
