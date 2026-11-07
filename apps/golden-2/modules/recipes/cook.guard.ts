import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";

/** Denied while `ctx.storage` key `recipes.guest` is `"1"`; redirects to `recipes.index`. */
export const cook = guard({ redirect: "recipes.index" }, async (_req, ctx) =>
  (await ctx.storage.get("recipes.guest")) === "1"
    ? err({ code: "keel.denied", message: "guests cannot add recipes", data: null })
    : ok(null),
);
