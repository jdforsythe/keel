import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { boxStores } from "./boxStores.ts";
import { kitchen } from "./kitchen.contract.ts";

export const postFavorite = action(kitchen, "kitchen.favorite", { stores: boxStores }, (_body, { params, stores }) => {
  if (!stores.box.get("recipes").some((r) => r.id === params.recipeId)) {
    return err({ code: "keel.notFound", message: "No such recipe", data: null });
  }
  const toggled = tx(stores.toggleFavorite, { recipeId: params.recipeId });
  return toggled.ok ? ok({}) : err(toggled.error);
});
