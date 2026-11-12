// routes.ts first: the pages import it back (E1505 cycle otherwise).
import "../modules/todos/routes.ts";
import { createCtx } from "@keel/ctx";
import { service } from "@keel/services";
import { type A11yNode, properties, render, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import AppShell from "../modules/todos/AppShell.tsx";
import EditTodoPage from "../modules/todos/EditTodoPage.tsx";
import ListError from "../modules/todos/ListError.tsx";
import ListPage from "../modules/todos/ListPage.tsx";
import { ListSearch } from "../modules/todos/ListSearch.schema.ts";
import ListsPage from "../modules/todos/ListsPage.tsx";
import Suggestions from "../modules/todos/Suggestions.tsx";
import TodoRow from "../modules/todos/TodoRow.tsx";
import { routes } from "../modules/todos/routes.ts";
import { suggestions } from "../modules/todos/suggestions.service.ts";
import { view } from "../modules/todos/view.ts";
import { boardOf } from "./at.ts";
import { readBoard, resetApi, seedBoard, simApi } from "./simApi.ts";

/** Id of the control (not a button) whose accessible name is `name`. */
function controlId(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role !== "button") return n.id;
    const inner = controlId(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}

const shown = view.snapshot();
afterEach(() => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
});

const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "high", done: true };
const SUGGESTIONS = new URL("/api/suggestions", location.href).href;
/** What the `api` deployable answers a runtime GET with (k.server): the `api.suggestions` loader `Result`. */
const served = (titles: string[]) =>
  new Response(
    JSON.stringify({
      id: "api.suggestions",
      results: { "api.suggestions": { ok: true, value: titles.map((title) => ({ title })) } },
    }),
  );

describe("TodoRow", () => {
  it("shows done, priority and an edit link", () => {
    const t = render(TodoRow, { props: { todo: milk } });
    expect(t.find("todos.toggle.t1")).toMatchObject({ role: "checkbox", name: "Done: Milk", state: { checked: true } });
    expect(t.find("todos.priority.t1").text).toBe("high");
    expect(t.find("todos.editLink.t1").name).toBe("Edit Milk");
    t.dispose();
  });
  it("the checkbox posts the toggle to the api and the row shows the re-read board", async () => {
    const seed = { lists: [L], todos: [{ ...milk, done: false }] };
    await seedBoard(boardOf(seed));
    const { ctx, sent } = await simApi();
    const t = render(TodoRow, { props: { todo: { ...milk, done: false } }, ctx });
    await t.fire("todos.toggle.t1", { type: "change" });
    await t.settle();
    expect(sent).toEqual(["POST /api/todos/t1/toggle", "GET /api/lists"]);
    expect(t.state(view).todos[0]?.done).toBe(true);
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(TodoRow);
  });
});

describe("AppShell", () => {
  it("has one navigation landmark", () => {
    const t = render(AppShell, { props: {}, state: [[view, { lists: [], todos: [], canUndo: false }]] as const });
    const roles = (nodes: readonly A11yNode[]): string[] => nodes.flatMap((n) => [n.role, ...roles(n.children)]);
    expect(roles(t.a11y()).filter((r) => r === "navigation")).toHaveLength(1);
    t.dispose();
  });
  it("Undo is disabled until the api reports something to undo, then posts /api/undo", async () => {
    const { ctx, sent } = await simApi();
    const t = render(AppShell, { props: {}, ctx });
    expect(t.find("todos.undo").state.disabled).toBe(true);
    const value = { lists: [L], todos: [], canUndo: true };
    const t2 = render(AppShell, { props: {}, ctx, state: [[view, value]] });
    expect(t2.find("todos.undo").state.disabled).toBeUndefined();
    await t2.fire("todos.undo", { type: "click" });
    await t2.settle();
    expect(sent).toEqual(["POST /api/undo", "GET /api/lists"]);
    expect(t2.state(view).canUndo).toBe(false);
    t2.dispose();
    t.dispose();
  });
});

describe("Suggestions", () => {
  it("goes loading to ready", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => served(["Eggs", "Bread"]));
    const t = render(Suggestions, { props: {}, ctx });
    expect(t.find("todos.suggestions.loading").text).toBe("Loading suggestions");
    await t.settle();
    expect(t.find("todos.suggestions.list").text).toBe("EggsBread");
    t.dispose();
  });
  it("goes loading to error on a sim 500", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => new Response("boom", { status: 500 }));
    const t = render(Suggestions, { props: {}, ctx });
    expect(t.find("todos.suggestions.loading").text).toBe("Loading suggestions");
    await t.settle();
    expect(t.find("todos.suggestions.error").text).toBe("Suggestions failed (500)");
    t.dispose();
  });
  it("goes loading to error when the body is not the api.suggestions Result", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => new Response(JSON.stringify([{ title: "Eggs" }])));
    const t = render(Suggestions, { props: {}, ctx });
    await t.settle();
    expect(t.find("todos.suggestions.error").text).toBe("Suggestions failed");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(Suggestions);
  });
});

describe("suggestions", () => {
  it("lists through ctx.net with accept: application/json and decodes the Result", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const accepts: (string | null)[] = [];
    ctx.net.route(SUGGESTIONS, (req) => {
      accepts.push(req.headers.get("accept"));
      return served(["Milk"]);
    });
    const r = await service({ module: "api", schema: suggestions }).list({}, ctx);
    expect(r.ok && r.value.results["api.suggestions"].value).toEqual([{ title: "Milk" }]);
    expect(accepts).toEqual(["application/json"]);
  });
});

const eggs = { id: "t2", listId: "l1", title: "Eggs", priority: "low", done: false };

describe("ListsPage", () => {
  it("shows each list with its open count and a link to it", () => {
    const value = { lists: [L], todos: [milk, { ...milk, id: "t2", done: false }], canUndo: false };
    const t = render(ListsPage, { props: {}, state: [[view, value]] });
    expect(t.find("todos.lists.title").text).toBe("Lists");
    expect(t.find("todos.listLink.l1").name).toBe("Home");
    expect(t.find("todos.openCount.l1").text).toBe("1 open");
    t.dispose();
  });
  it("shows no list rows for an empty board", () => {
    const t = render(ListsPage, { props: {} });
    expect(t.find("todos.lists.items").text).toBe("");
    t.dispose();
  });
});

describe("ListPage", () => {
  const props = (filter?: "all" | "active" | "done") => ({
    params: { listId: "l1" },
    search: filter === undefined ? {} : { filter },
    data: L,
  });
  const state = [[view, { lists: [L], todos: [milk, eggs], canUndo: false }]] as const;
  it("shows the list name and its filter links", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => served([]));
    const t = render(ListPage, { props: props(), state, ctx });
    expect(t.find("todos.list.title").text).toBe("Home");
    expect(t.find("todos.filter.done").name).toBe("Done");
    await t.settle();
    t.dispose();
  });
  it("names each row's edit link by its todo and keeps filters out of the landmarks", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => served([]));
    const t = render(ListPage, { props: props(), state, ctx });
    const names = (nodes: readonly A11yNode[]): string[] =>
      nodes.flatMap((n) => [
        ...(n.role === "link" && n.id.startsWith("todos.editLink.") ? [n.name] : []),
        ...names(n.children),
      ]);
    expect(names(t.a11y())).toEqual(["Edit Milk", "Edit Eggs"]);
    const roles = (nodes: readonly A11yNode[]): string[] => nodes.flatMap((n) => [n.role, ...roles(n.children)]);
    expect(roles(t.a11y()).filter((r) => r === "navigation")).toEqual([]);
    await t.settle();
    t.dispose();
  });
  it("shows only the done todos under the done filter", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => served([]));
    const t = render(ListPage, { props: props("done"), state, ctx });
    expect(t.find("todos.items").text).toContain("Milk");
    expect(t.find("todos.items").text).not.toContain("Eggs");
    await t.settle();
    t.dispose();
  });
  it("an invalid add-todo posts nothing and a valid one posts to the api", async () => {
    await seedBoard(boardOf({ lists: [L], todos: [milk] }));
    const { ctx, sent } = await simApi();
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx });
    await r.fire("todos.addTodo", { type: "click" });
    expect(sent.filter((x) => x.startsWith("POST"))).toEqual([]);
    const id = controlId(r.a11y(), "Title");
    await r.fire(id, { type: "input", value: "Bread" });
    await r.fire("todos.addTodo", { type: "click" });
    expect(sent.filter((x) => x.startsWith("POST"))).toEqual(["POST /api/lists/l1/todos"]);
    r.dispose();
  });
});

describe("EditTodoPage", () => {
  it("shows the heading and the todo's title in the form", () => {
    const t = render(EditTodoPage, {
      props: { params: { listId: "l1", todoId: "t1" }, data: milk },
    });
    expect(t.find("todos.edit.title").text).toBe("Edit todo");
    expect(t.find("todos.save").name).toBe("Save");
    t.dispose();
  });
  it("binds the todo's title and priority into the form controls", () => {
    const t = render(EditTodoPage, { props: { params: { listId: "l1", todoId: "t1" }, data: milk } });
    const title = t.find(controlId(t.a11y(), "Title"));
    const priority = t.find(controlId(t.a11y(), "Priority"));
    expect(title).toMatchObject({ role: "textbox", name: "Title" });
    expect(priority).toMatchObject({ role: "combobox", name: "Priority", text: "LowNormalHigh" });
    t.dispose();
  });
});

describe("EditTodoPage inside its route", () => {
  it("submitting untouched sends the bound title and priority to the api", async () => {
    await seedBoard(boardOf({ lists: [L], todos: [milk] }));
    const { ctx, sent } = await simApi();
    const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, ctx });
    await r.fire("todos.save", { type: "click" });
    expect(sent.filter((x) => x.startsWith("POST"))).toEqual(["POST /api/todos/t1"]);
    expect((await readBoard()).todos[0]).toMatchObject({ title: "Milk", priority: "high" });
    r.dispose();
  });
});

describe("ListError", () => {
  it("names the code, the message and links home", () => {
    const t = render(ListError, { props: { error: { code: "keel.notFound", message: "No list nope" } } });
    expect(t.find("todos.error.title").text).toBe("Not found");
    expect(t.find("todos.error.message").text).toBe("No list nope");
    expect(t.find("todos.error.home").name).toBe("Back to lists");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(ListError, { runs: 100, seed: 1337 });
  });
});

describe("ListSearch", () => {
  it("accepts a filter or none and rejects any other", () => {
    expect(ListSearch.parse({}).ok).toBe(true);
    expect(ListSearch.parse({ filter: "done" }).ok).toBe(true);
    expect(ListSearch.parse({ filter: "later" }).ok).toBe(false);
  });
});
