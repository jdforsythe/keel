import { s } from "@keel/schema";
import { MutationClaimSchema } from "./MutationClaimSchema.ts";

/**
 * The committed ledger file `keel ledger --write` produces (`tooling/ledger/ledger.json`, or `.keel/ledger.json` in
 * an app): unsafe count, host element count (k.host-element), items per rung, mutation (per package `{ score, threshold }` and the claims), exports, and
 * spec clauses and a11y claims with their rungs. `rungs`, `mutation`, `clauses` and `a11y` are optional on read.
 */
export const LedgerFileSchema = s.object({
  version: s.int(),
  unsafe: s.int(),
  hostElements: s.int({ min: 0 }),
  rungs: s.record(s.int({ min: 0 })).optional(),
  mutation: s
    .object({
      packages: s.record(s.object({ score: s.number().optional(), threshold: s.number() })),
      claims: s.array(MutationClaimSchema),
    })
    .optional(),
  exports: s.array(s.object({ pkg: s.string(), name: s.string(), file: s.string(), rung: s.string() })),
  clauses: s.array(s.object({ item: s.string(), rung: s.string() })).optional(),
  a11y: s.array(s.object({ item: s.string(), rung: s.string() })).optional(),
});
