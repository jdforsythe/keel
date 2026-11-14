import { s } from "@keel/schema";
import { line } from "@keel/std-text";

/** The recipes on the shopping list, by id and title, in the order they were added. */
export const ShoppingList = s.object({
  recipes: s.array(s.object({ id: s.id("Recipe"), title: line({ max: 80 }) })),
});

export type ShoppingList = s.infer<typeof ShoppingList>;
