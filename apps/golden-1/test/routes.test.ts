import { createCtx } from "@keel/ctx";
import { type A11yNode, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { board } from "../modules/todos/board.ts";
import { routes } from "../modules/todos/routes.ts";

const base = board.snapshot();
afterEach(() => {
  expect(board.restore(base).ok).toBe(true);
});

const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false };
const eggs = { id: "t2", listId: "l1", title: "Eggs", priority: "low", done: true };
const state = [[board, { lists: [L], todos: [milk, eggs] }]] as const;

/** Id of the control a form field generated (`form<n>:<path>`), found by its accessible name. */
function controlId(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role !== "button") return n.id;
    const inner = controlId(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}
const rowIds = (n: A11yNode): string[] => n.children.map((c) => c.id);

describe("todos.index", () => {
  it("lists every list with its open count and adds a list through the Form", async () => {
    const r = await renderRoute("todos.index", { routes, state });
    expect(r.find("todos.openCount.l1").text).toBe("1 open");
    await r.fire(controlId(r.a11y(), "List name"), { type: "input", value: "Work" });
    await r.fire("todos.addList", { type: "click" });
    expect(r.state(board).lists.map((l) => l.name)).toEqual(["Home", "Work"]);
    r.dispose();
  });
});

describe("todos.list", () => {
  it("filter=done shows only done todos", async () => {
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, search: { filter: "done" }, state });
    expect(rowIds(r.a11y("todos.items"))).toEqual(["todos.row.t2"]);
    r.dispose();
  });
  it("filter=active shows only open todos; no filter shows all", async () => {
    const active = await renderRoute("todos.list", {
      routes,
      params: { listId: "l1" },
      search: { filter: "active" },
      state,
    });
    expect(rowIds(active.a11y("todos.items"))).toEqual(["todos.row.t1"]);
    active.dispose();
    const all = await renderRoute("todos.list", { routes, params: { listId: "l1" }, state });
    expect(rowIds(all.a11y("todos.items"))).toEqual(["todos.row.t1", "todos.row.t2"]);
    all.dispose();
  });
  it("unknown listId renders ListError", async () => {
    const r = await renderRoute("todos.list", { routes, params: { listId: "nope" }, state });
    expect(r.find("todos.error.message").text).toBe("No list nope");
    r.dispose();
  });
  it("invalid add-todo sends nothing and focuses the title", async () => {
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, state });
    const title = controlId(r.a11y(), "Title");
    await r.fire("todos.addTodo", { type: "click" });
    expect(r.state(board).todos).toHaveLength(2);
    expect(r.find(title).state.focused).toBe(true);
    expect(r.find(`${title}:error`).text).not.toBe("");
    r.dispose();
  });
  it("a valid add-todo commits; Undo enables and undo restores the prior state", async () => {
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, state });
    expect(r.find("todos.undo").state.disabled).toBe(true);
    const before = r.state(board);
    await r.fire(controlId(r.a11y(), "Title"), { type: "input", value: "Bread" });
    await r.fire("todos.addTodo", { type: "click" });
    expect(r.state(board).todos.map((t) => t.title)).toEqual(["Milk", "Eggs", "Bread"]);
    expect(r.find("todos.undo").state.disabled).toBeUndefined();
    expect(board.undo()).toBe(true);
    expect(r.state(board)).toEqual(before);
    r.dispose();
  });
});

describe("todos.edit", () => {
  it("readOnly redirects to todos.index", async () => {
    const ctx = createCtx({ mode: "sim", seed: 3 });
    await ctx.storage.set("todos.readOnly", "1");
    const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, state, ctx });
    expect(r.route().id).toBe("todos.index");
    r.dispose();
  });
  it("unknown todoId renders ListError", async () => {
    const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "nope" }, state });
    expect(r.find("todos.error.title").text).toBe("Not found");
    r.dispose();
  });
  it("duplicate title shows the keel.fields error; a fresh title saves and navigates to todos.list", async () => {
    const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, state });
    const title = controlId(r.a11y(), "Title");
    await r.fire(title, { type: "input", value: "Eggs" });
    await r.fire("todos.save", { type: "click" });
    expect(r.find(`${title}:error`).text).toBe("Another todo has this title");
    expect(r.route().id).toBe("todos.edit");
    await r.fire(title, { type: "input", value: "Oat milk" });
    await r.fire("todos.save", { type: "click" });
    expect(r.route().id).toBe("todos.list");
    expect(r.state(board).todos[0]?.title).toBe("Oat milk");
    r.dispose();
  });
});
