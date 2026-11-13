import { manifest } from "@keel/router";
import { monitorRoutes } from "@keel/std-sessions/monitor";
import { ListParams } from "./ListParams.schema.ts";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { boardEvents } from "./boardEvents.server.ts";
import { loadBoard } from "./loadBoard.server.ts";
import { loadSuggestions } from "./loadSuggestions.server.ts";
import { postEdit } from "./postEdit.server.ts";
import { postList } from "./postList.server.ts";
import { postTodo } from "./postTodo.server.ts";
import { postToggle } from "./postToggle.server.ts";
import { postUndo } from "./postUndo.server.ts";

/**
 * The `api` deployable (node): it owns the board (`api.board`); `todos` reads and writes it over HTTP and follows the
 * board channel (`api.boardEvents`) to re-read after each save. `sessions.tally` answers the commit counts of the
 * `monitor` runner to a caller in `readers` (`module.ts`).
 */
export const routes = manifest({
  ...monitorRoutes.routes,
  "api.lists": { api: true, path: "/api/lists", loader: loadBoard },
  "api.listTodos": {
    api: true,
    path: "/api/lists/:listId/todos",
    params: ListParams,
  },
  "api.todo": {
    api: true,
    path: "/api/todos/:todoId",
    params: TodoIdParams,
  },
  "api.todoToggle": {
    api: true,
    path: "/api/todos/:todoId/toggle",
    params: TodoIdParams,
  },
  "api.undo": { api: true, path: "/api/undo" },
  "api.suggestions": { api: true, path: "/api/suggestions", loader: loadSuggestions },
  "api.boardEvents": { api: true, path: boardEvents.path, loader: boardEvents.loader },
});
routes.actions({
  "api.lists": { POST: postList },
  "api.listTodos": { POST: postTodo },
  "api.todo": { POST: postEdit },
  "api.todoToggle": { POST: postToggle },
  "api.undo": { POST: postUndo },
  "api.boardEvents": boardEvents.actions,
});
