import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { todosApi } from "./todosApi.ts";

type Params = { readonly listId: string };

/** POST on `todos.list`: `POST /api/lists/:listId/todos` on the `api` deployable, then revalidate. */
export const createTodo = action(TodoDraft, async (input, at: { readonly params: Params }, ctx) => {
  // listId comes from a route param (a plain string), so it parses into the branded id the endpoint takes.
  const listId = s.id("TodoList").parse(at.params.listId);
  if (!listId.ok) return err(listId.error);
  const r = await todosApi().addTodo({ params: { listId: listId.value }, body: input }, ctx);
  return r.ok ? ok(null) : err(r.error);
});
