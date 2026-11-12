import { manifest } from "@keel/router";
import { RecipeRef } from "./RecipeRef.schema.ts";
import { loadRecipes } from "./loadRecipes.server.ts";
import { postFavorite } from "./postFavorite.server.ts";
import { postRecipe } from "./postRecipe.server.ts";

export const routes = manifest({
  "kitchen.recipes": {
    api: true,
    path: "/api/recipes",
    loader: loadRecipes,
  },
  "kitchen.favorite": {
    api: true,
    path: "/api/recipes/:recipeId/favorite",
    params: RecipeRef,
  },
});
routes.actions({ "kitchen.recipes": { POST: postRecipe }, "kitchen.favorite": { POST: postFavorite } });
