import { s } from "@keel/schema";
import { Todo } from "./Todo.schema.ts";
import { TodoList } from "./TodoList.schema.ts";

/** The board as `GET /api/lists` serves it (`api.lists` loader data) and the `todos.view` store holds it. */
export const BoardView = s.object({
  lists: s.array(TodoList),
  todos: s.array(Todo),
  canUndo: s.boolean(),
});
export type BoardView = s.infer<typeof BoardView>;
