import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { BoardView } from "./BoardView.schema.ts";
import { FlowParams } from "./FlowParams.schema.ts";
import { ListParams } from "./ListParams.schema.ts";
import { ListWrite } from "./ListWrite.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { Suggestion } from "./Suggestion.schema.ts";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { TodoWrite } from "./TodoWrite.schema.ts";
import { ToggleWrite } from "./ToggleWrite.schema.ts";
import { WriteRefusal } from "./WriteRefusal.schema.ts";
import { boardChannel } from "./boardChannel.schema.ts";

/** What a refused board write answers: a 409 `keel.conflict` with the board's head, or a 422 `keel.fields`. */
const refused = { 409: s.json(), 422: WriteRefusal };

/**
 * The `api` module's routes: the board read and its writes (each body carries the write's `key` and `base`), undo, the
 * removal of a list and its undo, the suggested titles, and the board channel's event stream.
 */
export const api = contract("api", {
  "api.boardEvents": {
    method: "GET",
    path: "/api/board/events",
    query: Nothing,
    events: true,
    output: boardChannel.events,
  },
  "api.lists": { method: "GET", path: "/api/lists", output: BoardView },
  "api.createList": { method: "POST", path: "/api/lists", body: ListWrite, output: Nothing, errors: refused },
  "api.addTodo": {
    method: "POST",
    path: "/api/lists/:listId/todos",
    params: ListParams,
    body: TodoWrite,
    output: Nothing,
    errors: refused,
  },
  "api.editTodo": {
    method: "POST",
    path: "/api/todos/:todoId",
    params: TodoIdParams,
    body: TodoWrite,
    output: Nothing,
    errors: refused,
  },
  "api.toggleTodo": {
    method: "POST",
    path: "/api/todos/:todoId/toggle",
    params: TodoIdParams,
    body: ToggleWrite,
    output: Nothing,
    errors: refused,
  },
  "api.undo": { method: "POST", path: "/api/undo", output: Nothing },
  "api.removeList": { method: "POST", path: "/api/lists/:listId/remove", params: ListParams, output: Nothing },
  "api.undoRemoval": { method: "POST", path: "/api/removals/:flow/undo", params: FlowParams, output: Nothing },
  "api.suggestions": { method: "GET", path: "/api/suggestions", output: s.array(Suggestion) },
});
