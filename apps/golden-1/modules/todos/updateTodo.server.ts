import { action, href } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { board } from "./board.ts";
import { editTodo } from "./editTodo.ts";

type Params = { readonly listId: string; readonly todoId: string };

/** POST on `todos.edit`: `keel.fields` `{ title }` if another todo in the list has the title; else save and go to the list. */
export const updateTodo = action(TodoDraft, (input, at: { readonly params: Params }) => {
  const { listId, todoId } = at.params;
  const taken = board.get("todos").some((t) => t.listId === listId && t.id !== todoId && t.title === input.title);
  if (taken)
    return err({ code: "keel.fields", message: "Duplicate title", data: { title: "Another todo has this title" } });
  const payload = editTodo.schema.parse({ ...input, id: todoId });
  if (!payload.ok) return err(payload.error);
  const r = tx(editTodo, payload.value);
  return r.ok ? ok(href("todos.list", { listId })) : err(r.error);
});
