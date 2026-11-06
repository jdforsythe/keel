import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Todo } from "./Todo.schema.ts";
import { board } from "./board.ts";

type Params = { readonly listId: string; readonly todoId: string };

/** The todo `todoId` of list `listId`, else `keel.notFound`. */
export const loadTodo = loader(Todo, async ({ params }: { readonly params: Params }) => {
  const todo = board.get("todos").find((t) => t.id === params.todoId && t.listId === params.listId);
  return todo === undefined
    ? err({ code: "keel.notFound", message: `No todo ${params.todoId} in list ${params.listId}`, data: params })
    : ok(todo);
});
