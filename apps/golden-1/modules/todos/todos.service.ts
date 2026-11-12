import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { BoardView } from "../api/BoardView.schema.ts";
import { ListDraft } from "../api/ListDraft.schema.ts";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { FieldsReply } from "./FieldsReply.schema.ts";

/**
 * The board endpoints of the golden-1 `api` deployable (it owns the data), resolved by the topology (`todosApi`):
 * `lists` answers the `api.lists` loader's value, each action the href it returns (or none).
 */
export const todos = endpoints({
  lists: { method: "GET", path: "/api/lists", output: BoardView },
  createList: { method: "POST", path: "/api/lists", body: ListDraft, output: s.string().nullable() },
  addTodo: {
    method: "POST",
    path: "/api/lists/:listId/todos",
    params: s.object({ listId: s.id("TodoList") }),
    body: TodoDraft,
    output: s.string().nullable(),
  },
  toggleTodo: {
    method: "POST",
    path: "/api/todos/:todoId/toggle",
    params: s.object({ todoId: s.id("Todo") }),
    output: s.string().nullable(),
  },
  editTodo: {
    method: "POST",
    path: "/api/todos/:todoId",
    params: s.object({ todoId: s.id("Todo") }),
    body: TodoDraft,
    output: s.string().nullable(),
    errors: { 422: FieldsReply },
  },
  undo: { method: "POST", path: "/api/undo", output: s.string().nullable() },
});
