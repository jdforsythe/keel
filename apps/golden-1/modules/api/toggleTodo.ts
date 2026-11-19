import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.toggleTodo` on `board` (`boardStores`): flip `done` of todo `id`; an unknown id leaves the board unchanged. A
 * concurrent write rebases: a flip carries no value the writer read.
 */
export const toggleTodo = (board: Store<Board>) =>
  transaction(
    board,
    "api.toggleTodo",
    s.object({ id: s.id("Todo") }),
    (state, p) =>
      state.todos.some((t) => t.id === p.id)
        ? { ...state, todos: state.todos.map((t) => (t.id === p.id ? { ...t, done: !t.done } : t)) }
        : state,
    { concurrent: "rebase" },
  );
