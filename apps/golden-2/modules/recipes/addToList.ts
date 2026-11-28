import { transaction } from "@keel/store";
import { ShoppingList } from "./ShoppingList.schema.ts";
import { shoppingList } from "./shoppingList.ts";

/** Appends each payload recipe the list does not hold yet, once. */
export const addToList = transaction(shoppingList, "recipes.addToList", ShoppingList, (state, payload) => {
  const held = new Set(state.recipes.map((r) => r.id));
  const added = payload.recipes.filter((r) => {
    if (held.has(r.id)) return false;
    held.add(r.id);
    return true;
  });
  return { recipes: [...state.recipes, ...added] };
});
