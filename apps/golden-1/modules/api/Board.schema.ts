import { s } from "@keel/schema";
import { Todo } from "./Todo.schema.ts";
import { TodoList } from "./TodoList.schema.ts";

/** State of the `todos.board` store. */
export const Board = s.object({
  lists: s.array(TodoList),
  todos: s.array(Todo),
});
export type Board = s.infer<typeof Board>;
