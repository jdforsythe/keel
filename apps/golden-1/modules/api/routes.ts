import { manifest } from "@keel/router";
import { ListParams } from "../todos/ListParams.schema.ts";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { loadBoard } from "./loadBoard.server.ts";
import { loadSuggestions } from "./loadSuggestions.server.ts";
import { postEdit } from "./postEdit.server.ts";
import { postList } from "./postList.server.ts";
import { postTodo } from "./postTodo.server.ts";
import { postToggle } from "./postToggle.server.ts";
import { postUndo } from "./postUndo.server.ts";

/** The `api` deployable (node): it owns the board (`api.board`); `todos` reads and writes it over HTTP. */
export const routes = manifest({
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
});
routes.actions({
  "api.lists": { POST: postList },
  "api.listTodos": { POST: postTodo },
  "api.todo": { POST: postEdit },
  "api.todoToggle": { POST: postToggle },
  "api.undo": { POST: postUndo },
});
