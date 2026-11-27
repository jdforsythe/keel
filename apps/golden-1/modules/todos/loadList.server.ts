import { loader } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { TodoList } from "../api/TodoList.schema.ts";
import { refreshView } from "./refreshView.ts";
import { todos } from "./todos.contract.ts";

/** The list named by `listId` from a fresh board (`refreshView`), else `keel.notFound`. */
export const loadList = loader(todos, "todos.list", { output: TodoList }, async ({ params }, ctx) => {
  const board = await refreshView(ctx);
  if (!board.ok) return board;
  const list = board.value.lists.find((l) => l.id === params.listId);
  return list === undefined
    ? err(keelError.notFound.make({}))
    : ok(list);
});
