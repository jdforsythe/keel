import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { time } from "@keel/std-timings";
import { IndexData } from "./IndexData.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { recipes } from "./recipes.contract.ts";

/** Every recipe in the box from the api, or only the favorites, with the page's copy. */
export const loadIndex = loader(recipes, "recipes.index", { output: IndexData }, async ({ params, search }, ctx) => {
  const r = await time(ctx, "recipes.api.box", () => kitchenApi.box({}, ctx));
  if (!r.ok) return err(r.error);
  const all = r.value.recipes;
  return ok({
    recipes: search.only === "favorites" ? all.filter((x) => x.favorite) : all,
    text: await RecipesText.load(params.locale),
  });
});
