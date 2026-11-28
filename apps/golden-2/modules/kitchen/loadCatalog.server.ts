import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { applyQuery } from "@keel/std-tables";
import { time } from "@keel/std-timings";
import { Recipe } from "./Recipe.schema.ts";
import { catalogColumns } from "./catalogColumns.ts";
import { currencyTally } from "./currencyTally.server.ts";
import { kitchen } from "./kitchen.contract.ts";
import { kitchenDb } from "./kitchenDb.server.ts";
import { recipeColumns } from "./recipeColumns.ts";

/**
 * One page of five recipes from the box, searched, filtered and sorted by the query in the locale's collation. The
 * query is timed as `kitchen.catalog.query`, and the recipes it read are tallied by currency (`currencyTally`).
 */
export const loadCatalog = loader(kitchen, "kitchen.catalog", {}, async ({ params, search }, ctx) => {
  const recipes = await kitchenDb(ctx).query(sql(Recipe)`${recipeColumns} order by added_on, id`);
  if (!recipes.ok) return recipes;
  currencyTally(ctx, recipes.value);
  const rows = recipes.value.map((r) => ({ ...r, currency: r.price.currency }));
  const page = await time(ctx, "kitchen.catalog.query", () =>
    applyQuery(catalogColumns, rows, search, { pageSize: 5, locale: params.locale }),
  );
  return ok(page);
});
