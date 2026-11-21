import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/todos/:todoId`: replace title and priority, with the write's key and base. `keel.fields` `{ title }` when
 * another todo in the same list has the title; an unknown todo is `keel.notFound`; a write whose base is not the
 * board's head is `keel.conflict` (409, `api.editTodo` refuses concurrent writes); a write queued under an owner
 * other than `""` (golden-1 has no sign-in) is `offline.signin`.
 */
export const postEdit = action(api, "api.editTodo", { stores: boardStores }, (input, { params, caller, stores }) => {
  const { todoId } = params;
  const todos = stores.board.get("todos");
  const todo = todos.find((t) => t.id === todoId);
  if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
  const { write, ...draft } = input;
  const w = writeFor(write, "");
  if (!w.ok) return err(w.error);
  if (todos.some((t) => t.listId === todo.listId && t.id !== todoId && t.title === draft.title))
    return err({ code: "keel.fields", message: "Duplicate title", data: { title: "Another todo has this title" } });
  const r = tx(stores.editTodo, { ...draft, id: todoId }, { meta: { caller }, ...w.value });
  return r.ok ? ok({}) : err(r.error);
});
