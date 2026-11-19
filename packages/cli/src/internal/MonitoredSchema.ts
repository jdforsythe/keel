import { s } from "@keel/schema";

/** An app's `.keel/monitored.json` (k.ledger Production evidence), written from a std.monitor tally. */
export const MonitoredSchema = s.object({
  v: s.literal(1),
  origin: s.string(),
  from: s.number(),
  to: s.number(),
  tx: s.record(s.int({ min: 0 })),
});
