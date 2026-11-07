import { type Href, action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { TodoParams } from "./TodoParams.schema.ts";
import { routes } from "./routes.ts";
import { todosApi } from "./todosApi.ts";

/**
 * POST on `todos.edit`: `POST /api/todos/:todoId` on the `api` deployable. Its 422 `keel.fields` (`{ title }` when
 * another todo in the list has the title) is passed on to the Form; success goes to the list.
 */
export const updateTodo = action({ input: TodoDraft, params: TodoParams }, async (input, { params, url }, ctx) => {
  const r = await todosApi(new URL(url).origin).editTodo({ params: { todoId: params.todoId }, body: input }, ctx);
  if (!r.ok) return err(r.error.data.body?.error ?? r.error);
  const to: Href = routes.href("todos.list", { listId: params.listId });
  return ok(to);
});
