import { type RuleDef, defineRule } from "@keel/check";

/**
 * W2702 (std.conflicts, k.check registry): a rebased entry whose base state cannot be rebuilt (`folded`, `undo`).
 * `raceRecords` renders it at the file the analysis read; the registry holds its explanation.
 */
export const raceUnchecked: RuleDef = defineRule({
  code: "W2702",
  see: "std.conflicts",
  message: "a rebased entry's base state cannot be rebuilt",
  explain:
    "The entry's base was folded into the store or undone, so races against it are not checked. " +
    "Fix: run the analysis before the queue folds, or keep the entry's concurrent entries in the snapshot.",
  check: () => [],
});
