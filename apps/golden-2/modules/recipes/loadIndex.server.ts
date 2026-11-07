import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Box } from "./Box.schema.ts";
import { RecipeSearch } from "./RecipeSearch.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";

/** Every recipe in the box from the api, or only the favorites. */
export const loadIndex = loader({ output: Box, search: RecipeSearch }, async ({ search, url }, ctx) => {
  const r = await kitchenApi(new URL(url).origin).box({}, ctx);
  if (!r.ok) return err(r.error);
  const all = r.value.results["kitchen.recipes"].value.recipes;
  return ok({ recipes: search.only === "favorites" ? all.filter((x) => x.favorite) : all });
});
