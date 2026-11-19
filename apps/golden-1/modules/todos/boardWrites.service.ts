import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { ListWrite } from "../api/ListWrite.schema.ts";
import { TodoWrite } from "../api/TodoWrite.schema.ts";
import { ToggleWrite } from "../api/ToggleWrite.schema.ts";
import { WriteAnswer } from "./WriteAnswer.schema.ts";
import { WriteRefusal } from "./WriteRefusal.schema.ts";

/**
 * The board writes of the golden-1 `api` deployable, sent through `boardOutbox`: each body carries the write's `key`
 * and `base`. A 409 is a refusal the outbox reads (`keel.conflict` with the board's head); a 422 is `keel.fields`.
 */
export const boardWrites = endpoints({
  createList: {
    method: "POST",
    path: "/api/lists",
    body: ListWrite,
    output: WriteAnswer,
    errors: { 409: s.json(), 422: WriteRefusal },
  },
  addTodo: {
    method: "POST",
    path: "/api/lists/:listId/todos",
    params: s.object({ listId: s.id("TodoList") }),
    body: TodoWrite,
    output: WriteAnswer,
    errors: { 409: s.json(), 422: WriteRefusal },
  },
  toggleTodo: {
    method: "POST",
    path: "/api/todos/:todoId/toggle",
    params: s.object({ todoId: s.id("Todo") }),
    body: ToggleWrite,
    output: WriteAnswer,
    errors: { 409: s.json(), 422: WriteRefusal },
  },
  editTodo: {
    method: "POST",
    path: "/api/todos/:todoId",
    params: s.object({ todoId: s.id("Todo") }),
    body: TodoWrite,
    output: WriteAnswer,
    errors: { 409: s.json(), 422: WriteRefusal },
  },
});
