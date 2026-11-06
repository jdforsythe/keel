import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListDraft } from "./ListDraft.schema.ts";
import { addList } from "./addList.ts";

/** POST on `todos.index`: add a list with a fresh id, then revalidate. */
export const createList = action(ListDraft, (input, _at, ctx) => {
  const r = tx(addList, { id: ctx.random.id("TodoList"), name: input.name });
  return r.ok ? ok(null) : err(r.error);
});
