import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { TodoParams } from "./TodoParams.schema.ts";
import { routes } from "./routes.ts";
import { todosApi } from "./todosApi.ts";

/**
 * POST on `todos.edit`: `POST /api/todos/:todoId` on the `api` deployable. Its 422 `keel.fields` (`{ title }` when
 * another todo in the list has the title) is passed on to the Form; success goes to the list.
 */
export const updateTodo = action({ input: TodoDraft, params: TodoParams }, async (input, { params }, ctx) => {
  const r = await todosApi.editTodo({ params: { todoId: params.todoId }, body: input }, ctx);
  if (!r.ok) return err(r.error.data.body ?? r.error);
  return ok(routes.href("todos.list", { listId: params.listId }));
});
