import { addList } from "./addList.ts";
import { addTodo } from "./addTodo.ts";
import { board } from "./board.ts";
import { editTodo } from "./editTodo.ts";
import { hideList } from "./hideList.ts";
import { showList } from "./showList.ts";
import { toggleTodo } from "./toggleTodo.ts";

/**
 * The `api` deployable's server state (k.server Server state): the board and the `api.*` transactions bound
 * to it. Loaders and actions name it as `stores: boardStores`; each request gets its own instance, restored from and
 * saved to `ctx.storage` (`keel.store.api.board`).
 */
export function boardStores() {
  const b = board();
  return {
    board: b,
    addList: addList(b),
    addTodo: addTodo(b),
    toggleTodo: toggleTodo(b),
    editTodo: editTodo(b),
    hideList: hideList(b),
    showList: showList(b),
  };
}
