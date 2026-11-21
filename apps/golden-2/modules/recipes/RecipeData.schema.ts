import { s } from "@keel/schema";
import { Recipe } from "../kitchen/Recipe.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";

/** Loader data of `recipes.show`: the recipe and the page's copy. */
export const RecipeData = s.object({ recipe: Recipe, text: RecipesText });

export type RecipeData = s.infer<typeof RecipeData>;
