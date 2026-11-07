import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import type { Box } from "../recipes/Box.schema.ts";
import { NewRecipe } from "./NewRecipe.schema.ts";

export const addRecipe = (box: Store<Box>) =>
  transaction(box, "kitchen.addRecipe", NewRecipe, (state, payload) => ({
    recipes: [...state.recipes, { id: payload.id, title: payload.title, minutes: payload.minutes, favorite: false }],
  }));
