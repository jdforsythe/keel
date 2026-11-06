import { s } from "@keel/schema";

/** One ledger record (k.testing): an item and the highest rung it holds. */
export const LedgerSchema = s.object({
  kind: s.literal("ledger"),
  item: s.string(),
  rung: s.enum(["none", "example", "probabilistic", "exhaustive", "proven", "monitored"]),
  evidence: s.string(),
});
