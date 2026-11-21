import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Nothing } from "../kitchen/Nothing.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { recipes } from "./recipes.contract.ts";

/** POST on `recipes.show`: toggles the favorite through the api and revalidates. */
export const favoriteRecipe = action(recipes, "recipes.show", { input: Nothing }, async (_input, { params }, ctx) => {
  const r = await kitchenApi.favorite({ params: { recipeId: params.recipeId } }, ctx);
  return r.ok ? ok(null) : err(r.error.data.body ?? r.error);
});
