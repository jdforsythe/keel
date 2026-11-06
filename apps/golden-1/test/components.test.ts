import { createCtx } from "@keel/ctx";
import { properties, render } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import AppShell from "../modules/todos/AppShell.tsx";
import EditTodoPage from "../modules/todos/EditTodoPage.tsx";
import ListError from "../modules/todos/ListError.tsx";
import ListPage from "../modules/todos/ListPage.tsx";
import ListsPage from "../modules/todos/ListsPage.tsx";
import Suggestions from "../modules/todos/Suggestions.tsx";
import TodoRow from "../modules/todos/TodoRow.tsx";
import { board } from "../modules/todos/board.ts";
import "../modules/todos/routes.ts";

const base = board.snapshot();
afterEach(() => {
  expect(board.restore(base).ok).toBe(true);
});

const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "high", done: true };
const URL = "http://localhost/api/suggestions";

describe("TodoRow", () => {
  it("shows done, priority and an edit link", () => {
    const t = render(TodoRow, { props: { todo: milk } });
    expect(t.find("todos.toggle.t1")).toMatchObject({ role: "checkbox", name: "Done: Milk", state: { checked: true } });
    expect(t.find("todos.priority.t1").text).toBe("high");
    expect(t.find("todos.editLink.t1").name).toBe("Edit");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(TodoRow);
  });
});

describe("Suggestions", () => {
  it("goes loading to ready", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(URL, () => new Response(JSON.stringify([{ title: "Eggs" }, { title: "Bread" }])));
    const t = render(Suggestions, { props: {}, ctx });
    expect(t.find("todos.suggestions.loading").text).toBe("Loading suggestions");
    await t.fire("todos.suggestions.title", { type: "focus" });
    expect(t.find("todos.suggestions.list").text).toBe("EggsBread");
    t.dispose();
  });
  it("goes loading to error on a sim 500", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(URL, () => new Response("boom", { status: 500 }));
    const t = render(Suggestions, { props: {}, ctx });
    expect(t.find("todos.suggestions.loading").text).toBe("Loading suggestions");
    await t.fire("todos.suggestions.title", { type: "focus" });
    expect(t.find("todos.suggestions.error").text).toBe("Suggestions failed (500)");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(Suggestions);
  });
});

describe("pages", () => {
  it("AppShell disables Undo while the log is empty", () => {
    const t = render(AppShell, { props: {} });
    expect(t.find("todos.undo").state.disabled).toBe(true);
    expect(t.find("todos.home").name).toBe("Home");
    t.dispose();
  });
  it("ListError renders the error message", () => {
    const t = render(ListError, { props: { error: { code: "keel.notFound", message: "No list x" } } });
    expect(t.find("todos.error.message").text).toBe("No list x");
    t.dispose();
  });
  it("ListsPage lists every list", () => {
    const t = render(ListsPage, { props: {}, state: [[board, { lists: [L], todos: [] }]] });
    expect(t.find("todos.listLink.l1").name).toBe("Home");
    expect(t.find("todos.openCount.l1").text).toBe("0 open");
    t.dispose();
  });
  it("ListPage shows the list's todos", () => {
    const props = { params: { listId: "l1" }, search: {}, data: L };
    const t = render(ListPage, { props, state: [[board, { lists: [L], todos: [milk] }]] });
    expect(t.find("todos.list.title").text).toBe("Home");
    expect(t.find("todos.row.t1").role).toBe("listitem");
    t.dispose();
  });
  it("EditTodoPage starts from the todo's values", () => {
    const t = render(EditTodoPage, { props: { params: { listId: "l1", todoId: "t1" }, data: milk } });
    expect(t.find("todos.edit.title").text).toBe("Edit todo");
    expect(t.find("todos.save").name).toBe("Save");
    t.dispose();
  });
});
