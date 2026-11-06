import { invariant, store } from "@keel/store";
import { Board } from "./Board.schema.ts";

/** All lists and todos. Changes only through the `todos.*` transactions. */
export const board = store(Board, { lists: [], todos: [] }, { id: "todos.board" });

invariant(board, (state) => {
  const listIds = new Set(state.lists.map((l) => l.id));
  const todoIds = new Set(state.todos.map((t) => t.id));
  return (
    listIds.size === state.lists.length &&
    todoIds.size === state.todos.length &&
    state.todos.every((t) => listIds.has(t.listId))
  );
});
