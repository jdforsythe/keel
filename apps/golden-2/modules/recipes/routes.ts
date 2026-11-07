import { manifest } from "@keel/router";
import BoxShell from "./BoxShell.tsx";
import NewRecipePage from "./NewRecipePage.tsx";
import RecipeError from "./RecipeError.tsx";
import RecipeList from "./RecipeList.tsx";
import RecipePage from "./RecipePage.tsx";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { RecipeSearch } from "./RecipeSearch.schema.ts";
import { cook } from "./cook.guard.ts";
import { createRecipe } from "./createRecipe.server.ts";
import { favoriteRecipe } from "./favoriteRecipe.server.ts";
import { loadIndex } from "./loadIndex.server.ts";
import { loadRecipe } from "./loadRecipe.server.ts";

export const routes = manifest({
  "recipes.shell": { component: BoxShell },
  "recipes.index": {
    path: "/",
    search: RecipeSearch,
    loader: loadIndex,
    component: RecipeList,
    layout: "recipes.shell",
  },
  "recipes.new": {
    path: "/recipes/new",
    component: NewRecipePage,
    layout: "recipes.shell",
    guard: cook,
  },
  "recipes.show": {
    path: "/recipes/:recipeId",
    params: RecipeParams,
    loader: loadRecipe,
    component: RecipePage,
    layout: "recipes.shell",
    errorElement: RecipeError,
  },
});
routes.actions({ "recipes.new": { POST: createRecipe }, "recipes.show": { POST: favoriteRecipe } });
