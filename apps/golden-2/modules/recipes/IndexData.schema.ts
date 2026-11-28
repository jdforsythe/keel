import { s } from "@keel/schema";
import { Recipe } from "../kitchen/Recipe.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";

/** Loader data of `recipes.index`: the recipes shown and the page's copy. */
export const IndexData = s.object({ recipes: s.array(Recipe), text: RecipesText });

export type IndexData = s.infer<typeof IndexData>;
