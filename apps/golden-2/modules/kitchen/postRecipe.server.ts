import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { UTC, instantOf, plainDateOf } from "@keel/std-temporal";
import { tx } from "@keel/store";
import { boxStores } from "./boxStores.ts";
import { kitchen } from "./kitchen.contract.ts";

/** Adds a draft dated today in UTC; a title already in the box (ignoring case) is a `keel.fields` error on `title`. */
export const postRecipe = action(kitchen, "kitchen.add", { stores: boxStores }, (body, { stores }, ctx) => {
  const wanted = body.title.toLowerCase();
  if (stores.box.get("recipes").some((r) => r.title.toLowerCase() === wanted)) {
    return err({ code: "keel.fields", message: "Already in the box", data: { title: "Already in the box" } });
  }
  const now = instantOf(ctx.clock.now());
  if (!now.ok) return err(now.error);
  const added = tx(stores.addRecipe, {
    ...body,
    id: ctx.random.id("Recipe"),
    addedOn: plainDateOf(now.value, UTC),
  });
  return added.ok ? ok({}) : err(added.error);
});
