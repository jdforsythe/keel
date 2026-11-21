import { manifest } from "@keel/router";
import { api } from "./api.contract.ts";
import { boardEvents } from "./boardEvents.server.ts";
import { loadBoard } from "./loadBoard.server.ts";
import { loadSuggestions } from "./loadSuggestions.server.ts";
import { postEdit } from "./postEdit.server.ts";
import { postList } from "./postList.server.ts";
import { postRemove } from "./postRemove.server.ts";
import { postTodo } from "./postTodo.server.ts";
import { postToggle } from "./postToggle.server.ts";
import { postUndo } from "./postUndo.server.ts";
import { postUndoRemoval } from "./postUndoRemoval.server.ts";

/**
 * The `api` deployable (node): it owns the board (`api.lists`); `todos` reads and writes it over HTTP and follows the
 * board channel (`api.boardEvents`) to re-read after each save; `api.removeList` and `api.undoRemoval` start and undo a
 * list's removal (`removal`). `sessions.tally` answers the commit counts of the `monitor` runner to a caller in
 * `readers` (`module.ts`); the `sessions` module binds it.
 */
export const routes = manifest(api, {
  "api.boardEvents": { loader: boardEvents.loader },
  "api.lists": { loader: loadBoard },
  "api.createList": { action: postList },
  "api.addTodo": { action: postTodo },
  "api.editTodo": { action: postEdit },
  "api.toggleTodo": { action: postToggle },
  "api.undo": { action: postUndo },
  "api.removeList": { action: postRemove },
  "api.undoRemoval": { action: postUndoRemoval },
  "api.suggestions": { loader: loadSuggestions },
});
