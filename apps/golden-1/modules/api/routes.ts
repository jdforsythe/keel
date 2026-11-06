import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import ActionApi from "./ActionApi.ts";
import BoardApi from "./BoardApi.ts";
import SuggestionsApi from "./SuggestionsApi.ts";
import { loadBoard } from "./loadBoard.server.ts";
import { loadSuggestions } from "./loadSuggestions.server.ts";
import { postEdit } from "./postEdit.server.ts";
import { postList } from "./postList.server.ts";
import { postTodo } from "./postTodo.server.ts";
import { postToggle } from "./postToggle.server.ts";
import { postUndo } from "./postUndo.server.ts";

/** The `api` deployable (node): it owns the board (`api.board`); `todos` reads and writes it over HTTP. */
export const routes = manifest({
  "api.lists": { path: "/api/lists", loader: loadBoard, actions: { POST: postList }, component: BoardApi },
  "api.listTodos": {
    path: "/api/lists/:listId/todos",
    params: s.object({ listId: s.id("TodoList") }),
    actions: { POST: postTodo },
    component: ActionApi,
  },
  "api.todo": {
    path: "/api/todos/:todoId",
    params: s.object({ todoId: s.id("Todo") }),
    actions: { POST: postEdit },
    component: ActionApi,
  },
  "api.todoToggle": {
    path: "/api/todos/:todoId/toggle",
    params: s.object({ todoId: s.id("Todo") }),
    actions: { POST: postToggle },
    component: ActionApi,
  },
  "api.undo": { path: "/api/undo", actions: { POST: postUndo }, component: ActionApi },
  "api.suggestions": { path: "/api/suggestions", loader: loadSuggestions, component: SuggestionsApi },
});
