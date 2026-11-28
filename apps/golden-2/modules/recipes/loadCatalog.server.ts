import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { time } from "@keel/std-timings";
import { CatalogData } from "./CatalogData.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { recipes } from "./recipes.contract.ts";

/** The catalog page the api answers for the query, every recipe for the finder, and the page's copy. */
export const loadCatalog = loader(
  recipes,
  "recipes.catalog",
  { output: CatalogData },
  async ({ params, search }, ctx) => {
    const page = await time(ctx, "recipes.api.catalog", () =>
      kitchenApi.catalog({ params: { locale: params.locale }, query: search }, ctx),
    );
    if (!page.ok) return err(page.error);
    const box = await time(ctx, "recipes.api.box", () => kitchenApi.box({}, ctx));
    if (!box.ok) return err(box.error);
    return ok({ page: page.value, recipes: box.value.recipes, text: await RecipesText.load(params.locale) });
  },
);
