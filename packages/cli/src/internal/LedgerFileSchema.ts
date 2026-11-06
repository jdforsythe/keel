import { s } from "@keel/schema";

/** The committed ledger file (`tooling/ledger/ledger.json` or `.keel/ledger.json`). */
export const LedgerFileSchema = s.object({
  version: s.int(),
  unsafe: s.int(),
  exports: s.array(s.object({ pkg: s.string(), name: s.string(), file: s.string(), rung: s.string() })),
});
