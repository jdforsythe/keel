import { s } from "@keel/schema";

/** What one person owes of one cost, in the cost's minor units. The payer's own share is a share too. */
export const Share = s.object({
  person: s.id("Person"),
  amount: s.int({ min: 0, max: 1_000_000_000 }),
});
