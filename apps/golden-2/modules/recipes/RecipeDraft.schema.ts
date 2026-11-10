import { s } from "@keel/schema";
import { Money } from "@keel/std-money";
import { line } from "@keel/std-text";

export const RecipeDraft = s.object({
  title: line({ max: 80 }),
  minutes: s.int({ min: 1, max: 600 }),
  price: Money,
});

export type RecipeDraft = s.infer<typeof RecipeDraft>;
