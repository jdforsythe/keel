import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";

/** Stub edit permission: denied while `ctx.storage` key `todos.readOnly` is `"1"`; redirects to `todos.index`. */
export const editable = guard("editable", { redirect: "todos.index" }, async (_req, ctx) =>
  (await ctx.storage.get("todos.readOnly")) === "1"
    ? err({ code: "keel.denied", message: "todos are read-only", data: null })
    : ok(null),
);
