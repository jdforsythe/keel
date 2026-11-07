import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Nothing } from "./Nothing.schema.ts";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";

/** POST on `recipes.show`: toggles the favorite through the api and revalidates. */
export const favoriteRecipe = action({ input: Nothing, params: RecipeParams }, async (_input, { params, url }, ctx) => {
  const r = await kitchenApi(new URL(url).origin).favorite({ params: { recipeId: params.recipeId } }, ctx);
  return r.ok ? ok(null) : err(r.error.data.body?.error ?? r.error);
});
