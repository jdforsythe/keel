import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { RecipeRef } from "./RecipeRef.schema.ts";
import { kitchen } from "./kitchen.contract.ts";
import { kitchenDb } from "./kitchenDb.server.ts";

/** Toggles a recipe's favorite in one statement; an unknown id is `keel.notFound` (404). */
export const postFavorite = action(kitchen, "kitchen.favorite", {}, async (_body, { params }, ctx) => {
  const toggled = await kitchenDb(ctx).one(
    sql(RecipeRef)`update recipes set favorite = not favorite where id = ${params.recipeId} returning id as "recipeId"`,
  );
  return toggled.ok ? ok({}) : err(toggled.error);
});
