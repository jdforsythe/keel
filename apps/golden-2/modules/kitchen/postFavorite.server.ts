import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Nothing } from "../recipes/Nothing.schema.ts";
import { RecipeRef } from "../recipes/RecipeRef.schema.ts";
import { boxStores } from "./boxStores.ts";

export const postFavorite = action(
  { input: Nothing, params: RecipeRef, stores: boxStores },
  (_input, { params, stores }) => {
    if (!stores.box.get("recipes").some((r) => r.id === params.recipeId)) {
      return err({ code: "keel.notFound", message: "No such recipe", data: null });
    }
    const toggled = tx(stores.toggleFavorite, { recipeId: params.recipeId });
    return toggled.ok ? ok(null) : err(toggled.error);
  },
);
