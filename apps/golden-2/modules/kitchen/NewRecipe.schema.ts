import { s } from "@keel/schema";
import { Money } from "@keel/std-money";
import { PlainDate } from "@keel/std-temporal";
import { line } from "@keel/std-text";

/** The `kitchen.addRecipe` payload: the draft plus the id and date `postRecipe` minted. */
export const NewRecipe = s.object({
  id: s.id("Recipe"),
  title: line({ max: 80 }),
  minutes: s.int({ min: 1, max: 600 }),
  price: Money,
  addedOn: PlainDate,
});

export type NewRecipe = s.infer<typeof NewRecipe>;
