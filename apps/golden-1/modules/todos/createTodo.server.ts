import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { ListParams } from "../api/ListParams.schema.ts";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { todosApi } from "./todosApi.ts";

/** POST on `todos.list`: `POST /api/lists/:listId/todos` on the `api` deployable, then revalidate. */
export const createTodo = action({ input: TodoDraft, params: ListParams }, async (input, { params }, ctx) => {
  const r = await todosApi.addTodo({ params, body: input }, ctx);
  return r.ok ? ok(null) : err(r.error);
});
