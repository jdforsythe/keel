import { s } from "@keel/schema";

/**
 * One line of `ledger.ndjson`: a `ledger` or `ledger.mutation` record (k.ledger), a diagnostic by code and place, or
 * the run's summary.
 */
export const LedgerLine = s.union("kind", [
  s.object({
    kind: s.literal("ledger"),
    item: s.string(),
    rung: s.enum(["none", "example", "probabilistic", "exhaustive", "proven", "monitored"]),
    evidence: s.string(),
  }),
  s.object({
    kind: s.literal("ledger.mutation"),
    file: s.string(),
    score: s.number(),
    survived: s.int(),
    fresh: s.boolean(),
  }),
  s.object({
    kind: s.literal("diag"),
    code: s.string({ min: 5, max: 5 }),
    path: s.string().optional(),
    line: s.int().optional(),
    col: s.int().optional(),
    see: s.string().optional(),
  }),
  s.object({ kind: s.literal("summary"), ok: s.boolean(), name: s.string(), counts: s.record(s.int()) }),
]);
