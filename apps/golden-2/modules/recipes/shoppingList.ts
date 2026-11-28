import { invariant, store } from "@keel/store";
import { ShoppingList } from "./ShoppingList.schema.ts";

/** The shopping list in this browser tab; it starts empty. */
export const shoppingList = store(ShoppingList, { recipes: [] }, { id: "recipes.list" });

invariant(shoppingList, (state) => new Set(state.recipes.map((r) => r.id)).size === state.recipes.length);
