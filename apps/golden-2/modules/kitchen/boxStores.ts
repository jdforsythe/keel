import { invariant, store } from "@keel/store";
import { Box } from "../recipes/Box.schema.ts";
import { addRecipe } from "./addRecipe.ts";
import { toggleFavorite } from "./toggleFavorite.ts";

export const boxStores = () => {
  const box = store(Box, { recipes: [] }, { id: "kitchen.box" });
  invariant(
    box,
    (state) =>
      new Set(state.recipes.map((r) => r.id)).size === state.recipes.length &&
      new Set(state.recipes.map((r) => r.title.toLowerCase())).size === state.recipes.length,
  );
  return { box, addRecipe: addRecipe(box), toggleFavorite: toggleFavorite(box) };
};
