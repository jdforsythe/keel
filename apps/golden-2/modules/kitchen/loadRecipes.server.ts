import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Box } from "./Box.schema.ts";
import { boxStores } from "./boxStores.ts";

export const loadRecipes = loader({ output: Box, stores: boxStores }, async ({ stores }) =>
  ok({ recipes: stores.box.get("recipes") }),
);
