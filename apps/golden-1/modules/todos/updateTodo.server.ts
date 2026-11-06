import { action, href } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { todosApi } from "./todosApi.ts";

type Params = { readonly listId: string; readonly todoId: string };

/**
 * POST on `todos.edit`: `POST /api/todos/:todoId` on the `api` deployable. Its 422 `keel.fields` (`{ title }` when
 * another todo in the list has the title) is passed on to the Form; success goes to the list.
 */
export const updateTodo = action(TodoDraft, async (input, at: { readonly params: Params }, ctx) => {
  const todoId = s.id("Todo").parse(at.params.todoId);
  if (!todoId.ok) return err(todoId.error);
  const r = await todosApi().editTodo({ params: { todoId: todoId.value }, body: input }, ctx);
  if (r.ok) return ok(href("todos.list", { listId: at.params.listId }));
  return err(r.error.data.body?.error ?? r.error);
});
