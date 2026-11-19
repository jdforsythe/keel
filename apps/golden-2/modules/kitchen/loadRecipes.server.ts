import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Box } from "./Box.schema.ts";
import { boxStores } from "./boxStores.ts";
import { currencyTally } from "./currencyTally.server.ts";

/** Every recipe in the box; the read is tallied by currency (`currencyTally`). */
export const loadRecipes = loader({ output: Box, stores: boxStores }, async ({ stores }, ctx) => {
  const recipes = stores.box.get("recipes");
  currencyTally(ctx, recipes);
  return ok({ recipes });
});
