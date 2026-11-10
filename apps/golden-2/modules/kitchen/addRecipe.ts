import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import type { Box } from "../recipes/Box.schema.ts";
import { NewRecipe } from "./NewRecipe.schema.ts";

/** Adds the payload unless its id, or its title ignoring case, is already in the box; then the state is unchanged. */
export const addRecipe = (box: Store<Box>) =>
  transaction(box, "kitchen.addRecipe", NewRecipe, (state, payload) => {
    const title = payload.title.toLowerCase();
    const taken = state.recipes.some((r) => r.id === payload.id || r.title.toLowerCase() === title);
    return taken ? state : { recipes: [...state.recipes, { ...payload, favorite: false }] };
  });
