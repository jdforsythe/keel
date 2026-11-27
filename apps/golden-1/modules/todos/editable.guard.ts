import { guard } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";

/** Stub edit permission: denied while `ctx.storage` key `todos.readOnly` is `"1"`; redirects to `todos.index`. */
export const editable = guard({ redirect: "todos.index" }, async (_req, ctx) =>
  (await ctx.storage.get("todos.readOnly")) === "1"
    ? err(keelError.denied.make({}))
    : ok(null),
);
