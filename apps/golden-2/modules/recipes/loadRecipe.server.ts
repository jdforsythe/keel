import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Recipe } from "./Recipe.schema.ts";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";

/** The recipe named by `recipeId`, else `keel.notFound`. */
export const loadRecipe = loader({ output: Recipe, params: RecipeParams }, async ({ params, url }, ctx) => {
  const r = await kitchenApi(new URL(url).origin).box({}, ctx);
  if (!r.ok) return err(r.error);
  const found = r.value.results["kitchen.recipes"].value.recipes.find((x) => x.id === params.recipeId);
  return found === undefined
    ? err({ code: "keel.notFound", message: `No recipe ${params.recipeId}`, data: { recipeId: params.recipeId } })
    : ok(found);
});
