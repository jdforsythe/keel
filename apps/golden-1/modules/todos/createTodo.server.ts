import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { addTodo } from "./addTodo.ts";

type Params = { readonly listId: string };

/** POST on `todos.list`: add a todo with a fresh id to the list, then revalidate. */
export const createTodo = action(TodoDraft, (input, at: { readonly params: Params }, ctx) => {
  const payload = addTodo.schema.parse({ ...input, id: ctx.random.uuid(), listId: at.params.listId });
  if (!payload.ok) return err(payload.error);
  const r = tx(addTodo, payload.value);
  return r.ok ? ok(null) : err(r.error);
});
