import { s } from "@keel/schema";
import { CatalogResult } from "../kitchen/CatalogResult.schema.ts";
import { Recipe } from "../kitchen/Recipe.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";

/** Loader data of `recipes.catalog`: the table's page, every recipe for the finder, and the page's copy. */
export const CatalogData = s.object({ page: CatalogResult, recipes: s.array(Recipe), text: RecipesText });

export type CatalogData = s.infer<typeof CatalogData>;
