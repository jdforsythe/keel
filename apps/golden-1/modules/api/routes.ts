import { manifest } from "@keel/router";
import { ListParams } from "../todos/ListParams.schema.ts";
import ActionApi from "./ActionApi.ts";
import BoardApi from "./BoardApi.ts";
import SuggestionsApi from "./SuggestionsApi.ts";
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
  "api.lists": { path: "/api/lists", loader: loadBoard, component: BoardApi },
  "api.listTodos": {
    path: "/api/lists/:listId/todos",
    params: ListParams,
    component: ActionApi,
  },
  "api.todo": {
    path: "/api/todos/:todoId",
    params: TodoIdParams,
    component: ActionApi,
  },
  "api.todoToggle": {
    path: "/api/todos/:todoId/toggle",
    params: TodoIdParams,
    component: ActionApi,
  },
  "api.undo": { path: "/api/undo", component: ActionApi },
  "api.suggestions": { path: "/api/suggestions", loader: loadSuggestions, component: SuggestionsApi },
});
routes.actions({
  "api.lists": { POST: postList },
  "api.listTodos": { POST: postTodo },
  "api.todo": { POST: postEdit },
  "api.todoToggle": { POST: postToggle },
  "api.undo": { POST: postUndo },
});
