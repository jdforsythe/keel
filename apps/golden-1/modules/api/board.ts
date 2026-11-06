import { scope } from "@keel/reactive";
import { invariant, store } from "@keel/store";
import { Board } from "../todos/Board.schema.ts";

/**
 * All lists and todos, process-shared on the `api` server (k.server Server state). Changes only through the `api.*`
 * transactions; `todos` reads and writes it over HTTP. Created in an explicit module-lifetime scope (k.reactive
 * `scope.run`): `node server.ts` loads this file with type stripping only, without the compiler's module-scope
 * lowering, and a store outside any scope is E1203.
 */
export const board = scope(() => undefined).run(() => store(Board, { lists: [], todos: [] }, { id: "api.board" }));

invariant(board, (state) => {
  const listIds = new Set(state.lists.map((l) => l.id));
  const todoIds = new Set(state.todos.map((t) => t.id));
  return (
    listIds.size === state.lists.length &&
    todoIds.size === state.todos.length &&
    state.todos.every((t) => listIds.has(t.listId))
  );
});
