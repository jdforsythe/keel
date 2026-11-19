import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { IndexData } from "./IndexData.schema.ts";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { RecipeSearch } from "./RecipeSearch.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";

/** Every recipe in the box from the api, or only the favorites, with the page's copy. */
export const loadIndex = loader(
  { output: IndexData, params: LocaleParams, search: RecipeSearch },
  async ({ params, search }, ctx) => {
    const r = await kitchenApi.box({}, ctx);
    if (!r.ok) return err(r.error);
    const all = r.value.recipes;
    return ok({
      recipes: search.only === "favorites" ? all.filter((x) => x.favorite) : all,
      text: await RecipesText.load(params.locale),
    });
  },
);
