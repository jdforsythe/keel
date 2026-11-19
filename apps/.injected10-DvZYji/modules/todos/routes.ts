import { manifest } from "@keel/router";
import { ListParams } from "../api/ListParams.schema.ts";
import AppShell from "./AppShell.tsx";
import EditTodoPage from "./EditTodoPage.tsx";
import ListError from "./ListError.tsx";
import ListPage from "./ListPage.tsx";
import { ListSearch } from "./ListSearch.schema.ts";
import ListsPage from "./ListsPage.tsx";
import { TodoParams } from "./TodoParams.schema.ts";
import { createList } from "./createList.server.ts";
import { createTodo } from "./createTodo.server.ts";
import { editable } from "./editable.guard.ts";
import { loadIndex } from "./loadIndex.server.ts";
import { loadList } from "./loadList.server.ts";
import { loadTodo } from "./loadTodo.server.ts";
import { updateTodo } from "./updateTodo.server.ts";

export const routes = manifest({
  "todos.shell": { component: AppShell },
  "todos.index": {
    path: "/",
    loader: loadIndex,
    component: ListsPage,
    layout: "todos.shell",
    title: () => "Lists",
    errorElement: ListError,
  },
  "todos.list": {
    path: "/lists/:listId",
    params: ListParams,
    search: ListSearch,
    loader: loadList,
    component: ListPage,
    layout: "todos.shell",
    title: (p) => p.data.name,
    errorElement: ListError,
  },
  "todos.edit": {
    path: "/lists/:listId/todos/:todoId/edit",
    params: TodoParams,
    loader: loadTodo,
    component: EditTodoPage,
    layout: "todos.shell",
    guard: editable,
    title: (p) => `Edit ${p.data.title}`,
    errorElement: ListError,
  },
});
routes.actions({
  "todos.index": { POST: createList },
  "todos.list": { POST: createTodo },
  "todos.edit": { POST: updateTodo },
});
