import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Todo } from "./Todo.schema.ts";
import { refreshView } from "./refreshView.ts";

type Params = { readonly listId: string; readonly todoId: string };

/** The todo `todoId` of list `listId` from a fresh board (`refreshView`), else `keel.notFound`. */
export const loadTodo = loader(Todo, async ({ params }: { readonly params: Params }, ctx) => {
  const board = await refreshView(ctx);
  if (!board.ok) return board;
  const todo = board.value.todos.find((t) => t.id === params.todoId && t.listId === params.listId);
  return todo === undefined
    ? err({ code: "keel.notFound", message: `No todo ${params.todoId} in list ${params.listId}`, data: params })
    : ok(todo);
});
