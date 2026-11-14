import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { Box } from "../kitchen/Box.schema.ts";
import { CatalogParams } from "../kitchen/CatalogParams.schema.ts";
import { CatalogResult } from "../kitchen/CatalogResult.schema.ts";
import { CatalogSearch } from "../kitchen/CatalogSearch.schema.ts";
import { RecipeDraft } from "../kitchen/RecipeDraft.schema.ts";
import { RecipeRef } from "../kitchen/RecipeRef.schema.ts";
import { ErrorReply } from "./ErrorReply.schema.ts";

/** The `kitchen` routes `recipes` calls: `box` answers the `kitchen.recipes` loader's value, `catalog` one page of `kitchen.catalog`, each action its href or none. */
export const kitchen = endpoints({
  box: { method: "GET", path: "/api/recipes", output: Box },
  catalog: {
    method: "GET",
    path: "/api/catalog/:locale",
    params: CatalogParams,
    query: CatalogSearch,
    output: CatalogResult,
  },
  add: {
    method: "POST",
    path: "/api/recipes",
    body: RecipeDraft,
    output: s.string().nullable(),
    errors: { 422: ErrorReply },
  },
  favorite: {
    method: "POST",
    path: "/api/recipes/:recipeId/favorite",
    params: RecipeRef,
    output: s.string().nullable(),
    errors: { 404: ErrorReply },
  },
});
