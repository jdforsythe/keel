import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { tx } from "@keel/store";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { addTodo } from "./addTodo.ts";

type Params = { readonly listId: string };

/** POST on `todos.list`: add a todo with a fresh id to the list, then revalidate. */
export const createTodo = action(TodoDraft, (input, at: { readonly params: Params }, ctx) => {
  // listId comes from a route param (a plain string), so it still parses; the new id needs no parse.
  const listId = s.id("TodoList").parse(at.params.listId);
  if (!listId.ok) return err(listId.error);
  const payload = { ...input, id: ctx.random.id("Todo"), listId: listId.value };
  const r = tx(addTodo, payload);
  return r.ok ? ok(null) : err(r.error);
});
