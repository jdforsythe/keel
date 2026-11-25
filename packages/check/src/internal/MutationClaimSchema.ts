import { s } from "@keel/schema";

/**
 * One mutation claim (k.ledger Mutation): a mutated file (repo-relative), the sha256 of the source Stryker mutated,
 * its mutant counts (`killed` counts timeouts, as Stryker's score does; `justified` the Survived and NoCoverage mutants a
 * `mutation-justified.json` entry covers, 0 when a file on disk leaves it out) and its score in percent, stored to two decimals (shown to one).
 */
export const MutationClaimSchema = s.object({
  file: s.string(),
  sha: s.string(),
  killed: s.int({ min: 0 }),
  survived: s.int({ min: 0 }),
  noCoverage: s.int({ min: 0 }),
  justified: s.int({ min: 0 }).optional(),
  score: s.number(),
});
