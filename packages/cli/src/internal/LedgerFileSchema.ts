import { s } from "@keel/schema";
import { MutationClaimSchema } from "./MutationClaimSchema.ts";

/**
 * The committed ledger file `keel ledger --write` produces (`tooling/ledger/ledger.json`, or `.keel/ledger.json` in
 * an app): unsafe count, items per rung, mutation (per package `{ score, threshold }` and the claims), exports, and
 * spec clauses with their rungs. `rungs` and `mutation` are optional on read.
 */
export const LedgerFileSchema = s.object({
  version: s.int(),
  unsafe: s.int(),
  rungs: s.record(s.int({ min: 0 })).optional(),
  mutation: s
    .object({
      packages: s.record(s.object({ score: s.number().optional(), threshold: s.number() })),
      claims: s.array(MutationClaimSchema),
    })
    .optional(),
  exports: s.array(s.object({ pkg: s.string(), name: s.string(), file: s.string(), rung: s.string() })),
  clauses: s.array(s.object({ item: s.string(), rung: s.string() })).optional(),
});
