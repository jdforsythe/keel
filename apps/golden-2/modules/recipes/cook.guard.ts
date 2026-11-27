import { guard } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";

/** Denied while `ctx.storage` key `recipes.guest` is `"1"`; redirects to `recipes.index`. */
export const cook = guard({ redirect: "recipes.index" }, async (_req, ctx) =>
  (await ctx.storage.get("recipes.guest")) === "1"
    ? err(keelError.denied.make({}, "guests cannot add recipes"))
    : ok(null),
);
