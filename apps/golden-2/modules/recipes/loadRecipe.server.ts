import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { formatMessage } from "@keel/std-messages";
import { RecipeData } from "./RecipeData.schema.ts";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";

/** The recipe named by `recipeId` with the page's copy, else `keel.notFound` with the entry's message. */
export const loadRecipe = loader({ output: RecipeData, params: RecipeParams }, async ({ params }, ctx) => {
  const r = await kitchenApi.box({}, ctx);
  if (!r.ok) return err(r.error);
  const text = await RecipesText.load(params.locale);
  const recipe = r.value.recipes.find((x) => x.id === params.recipeId);
  return recipe === undefined
    ? err({
        code: "keel.notFound",
        message: formatMessage(text.notFound, { id: params.recipeId }, params.locale),
        data: { recipeId: params.recipeId },
      })
    : ok({ recipe, text });
});
