import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/** `api.addTodo` on `board` (`boardStores`): append an open todo to list `listId`; an unknown list or a duplicate id leaves the board unchanged. */
export const addTodo = (board: Store<Board>) =>
  transaction(
    board,
    "api.addTodo",
    s.object({
      id: s.id("Todo"),
      listId: s.id("TodoList"),
      title: s.string({ min: 1, max: 120 }),
      priority: s.enum(["low", "normal", "high"]),
    }),
    (state, p) =>
      state.todos.some((t) => t.id === p.id) || !state.lists.some((l) => l.id === p.listId)
        ? state
        : { ...state, todos: [...state.todos, { ...p, done: false }] },
  );
