import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { RecipeDraft } from "../recipes/RecipeDraft.schema.ts";
import { boxStores } from "./boxStores.ts";

export const postRecipe = action({ input: RecipeDraft, stores: boxStores }, (input, { stores }, ctx) => {
  const wanted = input.title.toLowerCase();
  if (stores.box.get("recipes").some((r) => r.title.toLowerCase() === wanted)) {
    return err({ code: "keel.fields", message: "Already in the box", data: { title: "Already in the box" } });
  }
  const added = tx(stores.addRecipe, { id: ctx.random.id("Recipe"), title: input.title, minutes: input.minutes });
  return added.ok ? ok(null) : err(added.error);
});
