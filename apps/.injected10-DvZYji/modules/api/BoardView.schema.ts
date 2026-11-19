import { s } from "@keel/schema";
import { Removal } from "./Removal.schema.ts";
import { Todo } from "./Todo.schema.ts";
import { TodoList } from "./TodoList.schema.ts";

/**
 * The board as `GET /api/lists` serves it (`api.lists` loader data) and the `todos.view` store holds it; `head` is the
 * board's head when it was read, the `base` a write names; `removals`, the removals not yet ended (`removal`).
 */
export const BoardView = s.object({
  lists: s.array(TodoList),
  todos: s.array(Todo),
  canUndo: s.boolean(),
  head: s.int({ min: 0 }),
  removals: s.array(Removal).optional(),
});
export type BoardView = s.infer<typeof BoardView>;
