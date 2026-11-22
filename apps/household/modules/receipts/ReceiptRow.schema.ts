import { s } from "@keel/schema";
import { Currency } from "@keel/std-money";
import { line, para } from "@keel/std-text";
import { Member } from "./Member.schema.ts";

/** One row of the `receipts` table as a query reads it: the total in minor units beside its currency. */
export const ReceiptRow = s.object({
  id: s.id("Receipt"),
  shop: line({ max: 60 }),
  amount: s.int({ min: 0 }),
  currency: Currency,
  paidBy: Member,
  note: para({ max: 500 }).nullable(),
});
