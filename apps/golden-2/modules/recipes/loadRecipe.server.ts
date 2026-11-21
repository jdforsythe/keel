import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { time } from "@keel/std-timings";
import { RecipeData } from "./RecipeData.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { recipes } from "./recipes.contract.ts";

/** The recipe named by `recipeId` with the page's copy, else `keel.notFound` with the entry's message, which never repeats the id. */
export const loadRecipe = loader(recipes, "recipes.show", { output: RecipeData }, async ({ params }, ctx) => {
  const r = await time(ctx, "recipes.api.box", () => kitchenApi.box({}, ctx));
  if (!r.ok) return err(r.error);
  const text = await RecipesText.load(params.locale);
  const recipe = r.value.recipes.find((x) => x.id === params.recipeId);
  return recipe === undefined
    ? err({
        code: "keel.notFound",
        message: text.notFound,
        data: null,
      })
    : ok({ recipe, text });
});
