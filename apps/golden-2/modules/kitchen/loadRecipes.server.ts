import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { Recipe } from "./Recipe.schema.ts";
import { currencyTally } from "./currencyTally.server.ts";
import { kitchen } from "./kitchen.contract.ts";
import { kitchenDb } from "./kitchenDb.server.ts";
import { recipeColumns } from "./recipeColumns.ts";

/** Every recipe in the box, oldest first; the read is tallied by currency (`currencyTally`). */
export const loadRecipes = loader(kitchen, "kitchen.box", {}, async (_args, ctx) => {
  const recipes = await kitchenDb(ctx).query(sql(Recipe)`${recipeColumns} order by added_on, id`);
  if (!recipes.ok) return recipes;
  currencyTally(ctx, recipes.value);
  return ok({ recipes: recipes.value });
});
