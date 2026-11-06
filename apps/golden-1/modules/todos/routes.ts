import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import AppShell from "./AppShell.tsx";
import EditTodoPage from "./EditTodoPage.tsx";
import ListError from "./ListError.tsx";
import ListPage from "./ListPage.tsx";
import ListsPage from "./ListsPage.tsx";
import { createList } from "./createList.server.ts";
import { createTodo } from "./createTodo.server.ts";
import { editable } from "./editable.guard.ts";
import { loadList } from "./loadList.server.ts";
import { loadTodo } from "./loadTodo.server.ts";
import { updateTodo } from "./updateTodo.server.ts";

export const routes = manifest({
  "todos.shell": { component: AppShell },
  "todos.index": { path: "/", actions: { POST: createList }, component: ListsPage, layout: "todos.shell" },
  "todos.list": {
    path: "/lists/:listId",
    params: s.object({ listId: s.id("TodoList") }),
    search: s.object({ filter: s.enum(["all", "active", "done"]).optional() }),
    loader: loadList,
    actions: { POST: createTodo },
    component: ListPage,
    layout: "todos.shell",
    errorElement: ListError,
  },
  "todos.edit": {
    path: "/lists/:listId/todos/:todoId/edit",
    params: s.object({ listId: s.id("TodoList"), todoId: s.id("Todo") }),
    loader: loadTodo,
    actions: { POST: updateTodo },
    component: EditTodoPage,
    layout: "todos.shell",
    guard: editable.name,
    errorElement: ListError,
  },
});
