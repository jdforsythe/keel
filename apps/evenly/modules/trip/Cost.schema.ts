import { s } from "@keel/schema";
import { Currency } from "@keel/std-money";
import { Share } from "./Share.schema.ts";

/** One shared cost: who paid it, what it came to in minor units of its currency, and each person's share of it. */
export const Cost = s.object({
  id: s.id("Cost"),
  title: s.string({ min: 1, max: 80 }),
  amount: s.int({ min: 1, max: 1_000_000_000 }),
  currency: Currency,
  payer: s.id("Person"),
  at: s.int({ min: 0 }),
  shares: s.array(Share),
});
