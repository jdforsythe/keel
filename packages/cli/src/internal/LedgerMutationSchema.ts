import { s } from "@keel/schema";

/** One `ledger.mutation` record (k.ledger Mutation): a claim's file, score in percent, survivors and freshness. */
export const LedgerMutationSchema = s.object({
  kind: s.literal("ledger.mutation"),
  file: s.string(),
  score: s.number(),
  survived: s.int({ min: 0 }),
  fresh: s.boolean(),
});
