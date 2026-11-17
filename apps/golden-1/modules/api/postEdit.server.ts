import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Nothing } from "./Nothing.schema.ts";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { TodoWrite } from "./TodoWrite.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/todos/:todoId`: replace title and priority, with the write's key and base. `keel.fields` `{ title }` when
 * another todo in the same list has the title; an unknown todo is `keel.notFound`; a write whose base is not the
 * board's head is `keel.conflict` (409, `api.editTodo` refuses concurrent writes).
 */
export const postEdit = action(
  { input: TodoWrite, params: TodoIdParams, output: Nothing, stores: boardStores },
  (input, { params, caller, stores }) => {
    const { todoId } = params;
    const todos = stores.board.get("todos");
    const todo = todos.find((t) => t.id === todoId);
    if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
    const { write, ...draft } = input;
    if (todos.some((t) => t.listId === todo.listId && t.id !== todoId && t.title === draft.title))
      return err({ code: "keel.fields", message: "Duplicate title", data: { title: "Another todo has this title" } });
    const r = tx(stores.editTodo, { ...draft, id: todoId }, { meta: { caller }, ...write });
    return r.ok ? ok({}) : err(r.error);
  },
);
