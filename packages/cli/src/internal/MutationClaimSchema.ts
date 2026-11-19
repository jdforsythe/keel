import { s } from "@keel/schema";

/**
 * One mutation claim (k.ledger Mutation): a mutated file (repo-relative), the sha256 of the source Stryker mutated,
 * its mutant counts (`killed` counts timeouts, as Stryker's score does) and its score in percent, stored to two decimals (shown to one).
 */
export const MutationClaimSchema = s.object({
  file: s.string(),
  sha: s.string(),
  killed: s.int({ min: 0 }),
  survived: s.int({ min: 0 }),
  noCoverage: s.int({ min: 0 }),
  score: s.number(),
});
