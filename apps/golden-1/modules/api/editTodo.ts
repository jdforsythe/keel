import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.editTodo` on `board` (`boardStores`): replace title and priority of todo `id`; an unknown id leaves the board
 * unchanged. A concurrent write is refused (`reject`, the default): its payload holds both fields as the editor read them.
 */
export const editTodo = (board: Store<Board>) =>
  transaction(
    board,
    "api.editTodo",
    s.object({
      id: s.id("Todo"),
      title: s.string({ min: 1, max: 120 }),
      priority: s.enum(["low", "normal", "high"]),
    }),
    (state, p) =>
      state.todos.some((t) => t.id === p.id)
        ? {
            ...state,
            todos: state.todos.map((t) => (t.id === p.id ? { ...t, title: p.title, priority: p.priority } : t)),
          }
        : state,
  );
