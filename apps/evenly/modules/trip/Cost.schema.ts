import { s } from "@keel/schema";
import { Share } from "./Share.schema.ts";

/** One shared cost: who paid it, what it came to in cents, and each person's share of it. */
export const Cost = s.object({
  id: s.id("Cost"),
  title: s.string({ min: 1, max: 80 }),
  cents: s.int({ min: 1, max: 100_000_000 }),
  payer: s.id("Person"),
  at: s.int({ min: 0 }),
  shares: s.array(Share),
});
