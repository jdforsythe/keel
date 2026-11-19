import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { CatalogSearch } from "../kitchen/CatalogSearch.schema.ts";
import { CatalogData } from "./CatalogData.schema.ts";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";

/** The catalog page the api answers for the query, every recipe for the finder, and the page's copy. */
export const loadCatalog = loader(
  { output: CatalogData, params: LocaleParams, search: CatalogSearch },
  async ({ params, search }, ctx) => {
    const page = await kitchenApi.catalog({ params: { locale: params.locale }, query: search }, ctx);
    if (!page.ok) return err(page.error);
    const box = await kitchenApi.box({}, ctx);
    if (!box.ok) return err(box.error);
    return ok({ page: page.value, recipes: box.value.recipes, text: await RecipesText.load(params.locale) });
  },
);
