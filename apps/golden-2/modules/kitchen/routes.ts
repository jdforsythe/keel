import { manifest } from "@keel/router";
import { RecipeParams } from "../recipes/RecipeParams.schema.ts";
import KitchenApi from "./KitchenApi.ts";
import { loadRecipes } from "./loadRecipes.server.ts";
import { postFavorite } from "./postFavorite.server.ts";
import { postRecipe } from "./postRecipe.server.ts";

export const routes = manifest({
  "kitchen.recipes": {
    path: "/api/recipes",
    loader: loadRecipes,
    actions: { POST: postRecipe },
    component: KitchenApi,
  },
  "kitchen.favorite": {
    path: "/api/recipes/:recipeId/favorite",
    params: RecipeParams,
    actions: { POST: postFavorite },
    component: KitchenApi,
  },
});
