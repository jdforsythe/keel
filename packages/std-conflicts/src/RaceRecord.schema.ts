import { s } from "@keel/schema";
import { RefRecord } from "./internal/RefRecord.schema.ts";

/**
 * Output record kind `conflicts.race` (std.conflicts): one diagnostic at `path` 1:1, the file the analysis read. `code`
 * is E2701 for a race (`reason` `order` or `invalid`, `against` its concurrent entries) and W2702 for an unchecked
 * entry (`reason` `folded` or `undo`, `against` empty).
 */
export const RaceRecord = s.object(
  {
    kind: s.literal("conflicts.race"),
    code: s.enum(["E2701", "W2702"]),
    path: s.string(),
    store: s.string(),
    entry: RefRecord,
    against: s.array(RefRecord),
    reason: s.enum(["order", "invalid", "folded", "undo"]),
  },
  { closed: true },
);
export type RaceRecord = s.infer<typeof RaceRecord>;
