import { formatter } from "@keel/cli";
import { s } from "@keel/schema";

/**
 * Output record kind `session.monitor` (std.monitor, docs/OUTPUT.md) that `keel session monitor` emits: the tally's
 * `origin`, its count of `transactions` and total `runs`, and the `file` written.
 */
export const SessionMonitorRecord = s.object(
  {
    kind: s.literal("session.monitor"),
    origin: s.string(),
    transactions: s.int(),
    runs: s.int(),
    file: s.string(),
  },
  { closed: true },
);
export type SessionMonitorRecord = s.infer<typeof SessionMonitorRecord>;

const compact = (r: SessionMonitorRecord): string =>
  `ok session monitor ${r.transactions} transactions, ${r.runs} runs -> ${r.file}`;

formatter("session.monitor", {
  schema: SessionMonitorRecord,
  compact,
  pretty: (r) => `${compact(r)}\n  origin: ${r.origin}`,
});
