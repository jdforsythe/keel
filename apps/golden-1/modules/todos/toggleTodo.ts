import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { board } from "./board.ts";

/** Flip `done` of todo `id`; an unknown id leaves the board unchanged. */
export const toggleTodo = transaction(board, "todos.toggleTodo", s.object({ id: s.id("Todo") }), (state, p) =>
  state.todos.some((t) => t.id === p.id)
    ? { ...state, todos: state.todos.map((t) => (t.id === p.id ? { ...t, done: !t.done } : t)) }
    : state,
);
