import { invariant, store } from "@keel/store";
import { Board } from "./Board.schema.ts";

/**
 * A fresh `api.board` (all lists and todos) with its invariant: ids unique, every todo in a known list. Call inside a
 * scope; `boardStores` creates one per request (k.server Server state), with the `api.*` transactions bound to it.
 */
export function board() {
  const b = store(Board, { lists: [], todos: [] }, { id: "api.board" });
  invariant(b, (state) => {
    const listIds = new Set(state.lists.map((l) => l.id));
    const todoIds = new Set(state.todos.map((t) => t.id));
    return (
      listIds.size === state.lists.length &&
      todoIds.size === state.todos.length &&
      state.todos.every((t) => listIds.has(t.listId))
    );
  });
  return b;
}
