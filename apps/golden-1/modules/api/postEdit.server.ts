import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { TodoDraft } from "../todos/TodoDraft.schema.ts";
import { board } from "./board.ts";
import { editTodo } from "./editTodo.ts";

type Params = { readonly todoId: string };

/**
 * `POST /api/todos/:todoId`: replace title and priority. `keel.fields` `{ title }` when another todo in the same list
 * has the title; an unknown todo is `keel.notFound`.
 */
export const postEdit = action(TodoDraft, (input, at: { readonly params: Params }) => {
  const { todoId } = at.params;
  const todos = board.get("todos");
  const todo = todos.find((t) => t.id === todoId);
  if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
  if (todos.some((t) => t.listId === todo.listId && t.id !== todoId && t.title === input.title))
    return err({ code: "keel.fields", message: "Duplicate title", data: { title: "Another todo has this title" } });
  const r = tx(editTodo, { ...input, id: todo.id });
  return r.ok ? ok(null) : err(r.error);
});
