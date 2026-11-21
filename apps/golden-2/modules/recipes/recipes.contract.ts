import { contract } from "@keel/router/contract";
import { CatalogSearch } from "../kitchen/CatalogSearch.schema.ts";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { RecipeSearch } from "./RecipeSearch.schema.ts";

/** The recipes module's pages: the index, the catalog, the new-recipe form and one recipe, in the shell layout. */
export const recipes = contract("recipes", {
  "recipes.shell": { layout: true },
  "recipes.index": { path: "/:locale", params: LocaleParams, search: RecipeSearch },
  "recipes.catalog": { path: "/:locale/catalog", params: LocaleParams, search: CatalogSearch },
  "recipes.new": { path: "/:locale/recipes/new", params: LocaleParams },
  "recipes.show": { path: "/:locale/recipes/:recipeId", params: RecipeParams },
});
