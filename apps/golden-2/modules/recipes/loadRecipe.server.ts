import { loader } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { time } from "@keel/std-timings";
import { RecipeData } from "./RecipeData.schema.ts";
import { RecipeNotFound } from "./RecipeNotFound.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { recipes } from "./recipes.contract.ts";

/**
 * The recipe named by `recipeId` with the page's copy, else `keel.notFound` (404) caused by `recipes.notFound`, which
 * holds the locale for the error element and never the id.
 */
export const loadRecipe = loader(recipes, "recipes.show", { output: RecipeData }, async ({ params }, ctx) => {
  const r = await time(ctx, "recipes.api.box", () => kitchenApi.box({}, ctx));
  if (!r.ok) return err(r.error);
  const text = await RecipesText.load(params.locale);
  const recipe = r.value.recipes.find((x) => x.id === params.recipeId);
  return recipe === undefined
    ? err(keelError.notFound.causedBy(RecipeNotFound.make({ locale: params.locale }), {}))
    : ok({ recipe, text });
});
