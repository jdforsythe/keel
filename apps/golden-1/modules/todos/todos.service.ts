import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { ActionReply } from "./ActionReply.schema.ts";
import { BoardReply } from "./BoardReply.schema.ts";
import { FieldsReply } from "./FieldsReply.schema.ts";
import { ListDraft } from "./ListDraft.schema.ts";
import { TodoDraft } from "./TodoDraft.schema.ts";

/**
 * The board endpoints of the golden-1 `api` deployable (it owns the data; k.server runtime `Result` bodies),
 * served from the page's origin (vite proxies `/api`). Build the client at call time with `todosApi(origin)`.
 */
export const todos = endpoints({
  lists: { method: "GET", path: "/api/lists", output: BoardReply },
  createList: { method: "POST", path: "/api/lists", body: ListDraft, output: ActionReply },
  addTodo: {
    method: "POST",
    path: "/api/lists/:listId/todos",
    params: s.object({ listId: s.id("TodoList") }),
    body: TodoDraft,
    output: ActionReply,
  },
  toggleTodo: {
    method: "POST",
    path: "/api/todos/:todoId/toggle",
    params: s.object({ todoId: s.id("Todo") }),
    output: ActionReply,
  },
  editTodo: {
    method: "POST",
    path: "/api/todos/:todoId",
    params: s.object({ todoId: s.id("Todo") }),
    body: TodoDraft,
    output: ActionReply,
    errors: { 422: FieldsReply },
  },
  undo: { method: "POST", path: "/api/undo", output: ActionReply },
});
