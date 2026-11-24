import { s } from "@keel/schema";
import { Currency } from "@keel/std-money";
import { line, para } from "@keel/std-text";
import { Member } from "./Member.schema.ts";

/** What the form sends: the amount as the person typed it, read by `parseMoney` in the action. */
export const NewReceipt = s.object({
  shop: line({ max: 60 }),
  amount: s.string({ min: 1, max: 16 }),
  currency: Currency,
  paidBy: Member,
  note: para({ max: 500 }).optional(),
});
