import { manifest } from "@keel/router";
import { CatalogParams } from "./CatalogParams.schema.ts";
import { CatalogSearch } from "./CatalogSearch.schema.ts";
import { RecipeRef } from "./RecipeRef.schema.ts";
import { loadCatalog } from "./loadCatalog.server.ts";
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
  "kitchen.catalog": {
    api: true,
    path: "/api/catalog/:locale",
    params: CatalogParams,
    search: CatalogSearch,
    loader: loadCatalog,
  },
});
routes.actions({ "kitchen.recipes": { POST: postRecipe }, "kitchen.favorite": { POST: postFavorite } });
