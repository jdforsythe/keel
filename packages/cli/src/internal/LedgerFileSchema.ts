import { s } from "@keel/schema";

/**
 * The committed ledger file `keel ledger --write` produces (`tooling/ledger/ledger.json`, or `.keel/ledger.json` in
 * an app): unsafe count, per-package mutation score, exports, and spec clauses with their rungs.
 */
export const LedgerFileSchema = s.object({
  version: s.int(),
  unsafe: s.int(),
  mutationScore: s.record(s.number()).optional(),
  exports: s.array(s.object({ pkg: s.string(), name: s.string(), file: s.string(), rung: s.string() })),
  clauses: s.array(s.object({ item: s.string(), rung: s.string() })).optional(),
});
