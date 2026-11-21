import { contract } from "@keel/router/contract";
import { Tally } from "@keel/std-report";
import { Box } from "./Box.schema.ts";
import { CatalogParams } from "./CatalogParams.schema.ts";
import { CatalogResult } from "./CatalogResult.schema.ts";
import { CatalogSearch } from "./CatalogSearch.schema.ts";
import { ErrorReply } from "./ErrorReply.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { RecipeDraft } from "./RecipeDraft.schema.ts";
import { RecipeRef } from "./RecipeRef.schema.ts";

/** The kitchen module's routes: the box, adding to it, favorites, one catalog page, the currency tally. */
export const kitchen = contract("kitchen", {
  "kitchen.box": { method: "GET", path: "/api/recipes", output: Box },
  "kitchen.add": {
    method: "POST",
    path: "/api/recipes",
    body: RecipeDraft,
    output: Nothing,
    errors: { 422: ErrorReply },
  },
  "kitchen.favorite": {
    method: "POST",
    path: "/api/recipes/:recipeId/favorite",
    params: RecipeRef,
    output: Nothing,
    errors: { 404: ErrorReply },
  },
  "kitchen.catalog": {
    method: "GET",
    path: "/api/catalog/:locale",
    params: CatalogParams,
    query: CatalogSearch,
    output: CatalogResult,
  },
  "kitchen.currencyTally": { method: "GET", path: "/api/tally/currency", output: Tally },
});
