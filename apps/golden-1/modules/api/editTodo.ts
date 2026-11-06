import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { board } from "./board.ts";

/** Replace title and priority of todo `id`; an unknown id leaves the board unchanged. */
export const editTodo = transaction(
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
