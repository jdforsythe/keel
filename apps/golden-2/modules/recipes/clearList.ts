import { transaction } from "@keel/store";
import { Nothing } from "../kitchen/Nothing.schema.ts";
import { shoppingList } from "./shoppingList.ts";

/** Empties the shopping list. */
export const clearList = transaction(shoppingList, "recipes.clearList", Nothing, () => ({ recipes: [] }));
