import { formatter } from "@keel/cli";
import { s } from "@keel/schema";

/** A counted tally, output record kind `report.tally` (std.report). Rows: `n` descending, then `key` ascending. */
export const Tally = s.object(
  {
    kind: s.literal("report.tally"),
    id: s.string({ min: 1, max: 60 }),
    rows: s.array(s.object({ key: s.string({ min: 1, max: 60 }), n: s.int({ min: 1 }) }, { closed: true })),
  },
  { closed: true },
);
export type Tally = s.infer<typeof Tally>;

/** `orders.status paid=3 open=1`; `id 0` without rows. */
const compact = (t: Tally): string =>
  t.rows.length === 0 ? `${t.id} 0` : [t.id, ...t.rows.map((r) => `${r.key}=${r.n}`)].join(" ");

/** The id line, then keys left-aligned to the longest key and counts right-aligned to the widest count. */
const pretty = (t: Tally): string => {
  const kw = Math.max(0, ...t.rows.map((r) => r.key.length));
  const nw = Math.max(0, ...t.rows.map((r) => String(r.n).length));
  return [t.id, ...t.rows.map((r) => `${r.key.padEnd(kw)}  ${String(r.n).padStart(nw)}`)].join("\n");
};

formatter("report.tally", { schema: Tally, compact, pretty });
