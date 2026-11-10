import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import type { Box } from "../recipes/Box.schema.ts";
import { RecipeRef } from "../recipes/RecipeRef.schema.ts";

export const toggleFavorite = (box: Store<Box>) =>
  transaction(box, "kitchen.toggleFavorite", RecipeRef, (state, payload) => ({
    recipes: state.recipes.map((r) => (r.id === payload.recipeId ? { ...r, favorite: !r.favorite } : r)),
  }));
