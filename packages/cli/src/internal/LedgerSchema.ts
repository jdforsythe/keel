import { s } from "@keel/schema";

/** One ledger record (k.ledger): an item, the highest rung it holds and, for a spec clause, its position `n`. */
export const LedgerSchema = s.object({
  kind: s.literal("ledger"),
  item: s.string(),
  rung: s.enum(["none", "example", "probabilistic", "exhaustive", "proven", "monitored"]),
  evidence: s.string(),
  n: s.int().optional(),
});
