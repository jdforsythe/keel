import { type RuleDef, defineRule } from "@keel/check";

/**
 * E2701 (std.conflicts, k.check registry): a rebased entry that races its concurrent entries. `findRaces` reports it
 * and `raceRecords` renders it at the file the analysis read; the registry holds its explanation.
 */
export const raceFound: RuleDef = defineRule({
  code: "E2701",
  see: "std.conflicts",
  message: "a rebased entry races its concurrent entries",
  explain:
    "Replaying the entry after its concurrent entries gives a different state, or an invalid one. " +
    "Fix: make the transaction commute, or have it read the field it changes.",
  check: () => [],
});
