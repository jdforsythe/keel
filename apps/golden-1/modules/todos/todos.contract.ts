import { contract } from "@keel/router/contract";
import { ListParams } from "../api/ListParams.schema.ts";
import { ListSearch } from "./ListSearch.schema.ts";
import { TodoParams } from "./TodoParams.schema.ts";

/** The `todos` module's pages: the lists, one list and the edit page of one todo, inside the app shell. */
export const todos = contract("todos", {
  "todos.shell": { layout: true },
  "todos.index": { path: "/" },
  "todos.list": { path: "/lists/:listId", params: ListParams, search: ListSearch },
  "todos.edit": { path: "/lists/:listId/todos/:todoId/edit", params: TodoParams },
});
