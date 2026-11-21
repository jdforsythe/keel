import { s } from "@keel/schema";
import { Money } from "@keel/std-money";
import { line, para } from "@keel/std-text";
import { Member } from "./Member.schema.ts";

export const Receipt = s.object({
  id: s.id("Receipt"),
  shop: line({ max: 60 }),
  total: Money,
  paidBy: Member,
  note: para({ max: 500 }).optional(),
});
