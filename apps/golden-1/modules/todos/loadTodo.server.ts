import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Todo } from "../api/Todo.schema.ts";
import { editorChart } from "./editorChart.ts";
import { editorFollow } from "./editorFollow.ts";
import { refreshView } from "./refreshView.ts";
import { todos } from "./todos.contract.ts";

/**
 * The todo `todoId` of list `listId` from a fresh board (`refreshView`), else `keel.notFound`. Opening it brings
 * `editorChart` up to the outbox (`editorFollow`), then moves it from `viewing` to `editing`.
 */
export const loadTodo = loader(todos, "todos.edit", { output: Todo }, async ({ params }, ctx) => {
  const board = await refreshView(ctx);
  if (!board.ok) return board;
  const todo = board.value.todos.find((t) => t.id === params.todoId && t.listId === params.listId);
  if (todo === undefined)
    return err({ code: "keel.notFound", message: `No todo ${params.todoId} in list ${params.listId}`, data: params });
  const followed = editorFollow();
  if (!followed.ok) return err(followed.error);
  const opened = tx(editorChart.events.edit, {});
  return opened.ok ? ok(todo) : err(opened.error);
});
