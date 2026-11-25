import { s } from "@keel/schema";

/** What one person owes of one cost, in cents. The payer's own share is a share too. */
export const Share = s.object({
  person: s.id("Person"),
  cents: s.int({ min: 0, max: 100_000_000 }),
});
