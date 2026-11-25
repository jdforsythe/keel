import { s } from "@keel/schema";
import { Currency } from "@keel/std-money";
import { line } from "@keel/std-text";

/**
 * The cost form as the reader fills it. The amount is text, read as money in the action; `parts` holds one whole number of
 * parts as text per person id, and the cost divides in proportion to them.
 */
export const CostDraft = s.object({
  title: line({ max: 80 }),
  amount: s.string({ min: 1, max: 40 }),
  currency: Currency,
  payer: s.id("Person"),
  parts: s.record(s.string({ min: 1, max: 4 })),
});
