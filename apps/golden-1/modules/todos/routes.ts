import { manifest } from "@keel/router";
import AppShell from "./AppShell.tsx";
import EditTodoPage from "./EditTodoPage.tsx";
import ListError from "./ListError.tsx";
import ListPage from "./ListPage.tsx";
import ListsPage from "./ListsPage.tsx";
import { createList } from "./createList.server.ts";
import { createTodo } from "./createTodo.server.ts";
import { editable } from "./editable.guard.ts";
import { loadIndex } from "./loadIndex.server.ts";
import { loadList } from "./loadList.server.ts";
import { loadTodo } from "./loadTodo.server.ts";
import { todos } from "./todos.contract.ts";
import { updateTodo } from "./updateTodo.server.ts";

export const routes = manifest(todos, {
  "todos.shell": { component: AppShell },
  "todos.index": {
    loader: loadIndex,
    component: ListsPage,
    layout: "todos.shell",
    title: () => "Lists",
    errorElement: ListError,
    POST: createList,
  },
  "todos.list": {
    loader: loadList,
    component: ListPage,
    layout: "todos.shell",
    title: (p) => p.data.name,
    errorElement: ListError,
    POST: createTodo,
  },
  "todos.edit": {
    loader: loadTodo,
    component: EditTodoPage,
    layout: "todos.shell",
    guard: editable,
    title: (p) => `Edit ${p.data.title}`,
    errorElement: ListError,
    POST: updateTodo,
  },
});
