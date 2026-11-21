import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { Recipe } from "./Recipe.schema.ts";
import { currencyTally } from "./currencyTally.server.ts";
import { kitchen } from "./kitchen.contract.ts";
import { kitchenDb } from "./kitchenDb.server.ts";
import { recipeColumns } from "./recipeColumns.ts";

/** The box's recipes counted by the currency of their price (`currencyTally`), as `keel report` reads it from a build. */
export const loadCurrencyTally = loader(kitchen, "kitchen.currencyTally", {}, async (_args, ctx) => {
  const recipes = await kitchenDb(ctx).query(sql(Recipe)`${recipeColumns}`);
  return recipes.ok ? ok(currencyTally(ctx, recipes.value)) : recipes;
});
