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
