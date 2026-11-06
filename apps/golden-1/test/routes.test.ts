import { createCtx } from "@keel/ctx";
import { type A11yNode, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { board } from "../modules/api/board.ts";
import { routes } from "../modules/todos/routes.ts";
import { view } from "../modules/todos/view.ts";
import { simApi } from "./simApi.ts";

const served = board.snapshot();
const shown = view.snapshot();
afterEach(() => {
  expect(board.restore(served).ok).toBe(true);
  expect(view.restore(shown).ok).toBe(true);
});

const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false } as const;
const eggs = { id: "t2", listId: "l1", title: "Eggs", priority: "low", done: true } as const;
/** The `api` deployable's board (the data lives behind the API; the client only hydrates `todos.view`). */
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
  it("lists every list with its open count from the api and adds a list through the Form", async () => {
    const { ctx, sent } = await simApi();
    const r = await renderRoute("todos.index", { routes, state, ctx });
    expect(r.find("todos.openCount.l1").text).toBe("1 open");
    await r.fire(controlId(r.a11y(), "List name"), { type: "input", value: "Work" });
    await r.fire("todos.addList", { type: "click" });
    expect(board.get("lists").map((l) => l.name)).toEqual(["Home", "Work"]);
    expect(r.state(view).lists.map((l) => l.name)).toEqual(["Home", "Work"]);
    expect(sent).toEqual(["GET /api/lists", "POST /api/lists", "GET /api/lists"]);
    r.dispose();
  });
  it("a created list survives navigation and a refresh (a fresh client finds it through the api)", async () => {
    const first = await simApi();
    const r = await renderRoute("todos.index", { routes, ctx: first.ctx });
    await r.fire(controlId(r.a11y(), "List name"), { type: "input", value: "Work" });
    await r.fire("todos.addList", { type: "click" });
    const listId = board.get("lists")[0]?.id ?? "";
    await r.fire(`todos.listLink.${listId}`, { type: "click" });
    expect(r.route()).toMatchObject({ id: "todos.list", params: { listId } });
    expect(r.find("todos.list.title").text).toBe("Work");
    r.dispose();
    // A reload: a new client whose view store starts empty; only the api still has the list.
    expect(view.restore(shown).ok).toBe(true);
    const again = await simApi(2);
    const reloaded = await renderRoute("todos.list", { routes, params: { listId }, ctx: again.ctx });
    expect(reloaded.find("todos.list.title").text).toBe("Work");
    expect(again.sent).toEqual(["GET /api/lists", "GET /api/suggestions"]);
    reloaded.dispose();
  });
});

describe("todos.list", () => {
  it("filter=done shows only done todos", async () => {
    const { ctx } = await simApi();
    const r = await renderRoute("todos.list", {
      routes,
      params: { listId: "l1" },
      search: { filter: "done" },
      state,
      ctx,
    });
    expect(rowIds(r.a11y("todos.items"))).toEqual(["todos.row.t2"]);
    r.dispose();
  });
  it("filter=active shows only open todos; no filter shows all", async () => {
    const one = await simApi();
    const active = await renderRoute("todos.list", {
      routes,
      params: { listId: "l1" },
      search: { filter: "active" },
      state,
      ctx: one.ctx,
    });
    expect(rowIds(active.a11y("todos.items"))).toEqual(["todos.row.t1"]);
    active.dispose();
    const two = await simApi();
    const all = await renderRoute("todos.list", { routes, params: { listId: "l1" }, state, ctx: two.ctx });
    expect(rowIds(all.a11y("todos.items"))).toEqual(["todos.row.t1", "todos.row.t2"]);
    all.dispose();
  });
  it("Suggestions inside the route receive ctx and show the api's suggestions", async () => {
    const { ctx } = await simApi();
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, state, ctx });
    await r.fire("todos.suggestions.title", { type: "focus" });
    expect(r.find("todos.suggestions.list").text).toBe("BreadEggsMilk");
    r.dispose();
  });
  it("unknown listId renders ListError", async () => {
    const { ctx } = await simApi();
    const r = await renderRoute("todos.list", { routes, params: { listId: "nope" }, state, ctx });
    expect(r.find("todos.error.message").text).toBe("No list nope");
    r.dispose();
  });
  it("an api failure renders ListError with the api error", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(new URL("/api/*", location.href).href, () => new Response("boom", { status: 503 }));
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx });
    expect(r.find("todos.error.message").text).toBe("status 503");
    r.dispose();
  });
  it("invalid add-todo sends nothing and focuses the title", async () => {
    const { ctx, sent } = await simApi();
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, state, ctx });
    const title = controlId(r.a11y(), "Title");
    await r.fire("todos.addTodo", { type: "click" });
    expect(board.get("todos")).toHaveLength(2);
    expect(sent.filter((x) => x.startsWith("POST"))).toEqual([]);
    expect(r.find(title).state.focused).toBe(true);
    expect(r.find(`${title}:error`).text).not.toBe("");
    r.dispose();
  });
  it("a valid add-todo posts and shows the row; Undo enables and posts /api/undo, restoring the prior board", async () => {
    const { ctx, sent } = await simApi();
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, state, ctx });
    expect(r.find("todos.undo").state.disabled).toBe(true);
    const before = board.snapshot().state;
    await r.fire(controlId(r.a11y(), "Title"), { type: "input", value: "Bread" });
    await r.fire("todos.addTodo", { type: "click" });
    expect(board.get("todos").map((t) => t.title)).toEqual(["Milk", "Eggs", "Bread"]);
    expect(rowIds(r.a11y("todos.items"))).toHaveLength(3);
    expect(r.find("todos.undo").state.disabled).toBeUndefined();
    await r.fire("todos.undo", { type: "click" });
    expect(board.snapshot().state).toEqual(before);
    expect(r.state(view).todos.map((t) => t.title)).toEqual(["Milk", "Eggs"]);
    expect(r.find("todos.undo").state.disabled).toBe(true);
    expect(sent.filter((x) => x.startsWith("POST"))).toEqual(["POST /api/lists/l1/todos", "POST /api/undo"]);
    r.dispose();
  });
});

describe("event props (RFC 0009)", () => {
  it("firing the row checkbox posts the toggle; firing Undo restores the prior board", async () => {
    const { ctx } = await simApi();
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, state, ctx });
    await r.fire("todos.toggle.t1", { type: "change" });
    expect(board.get("todos").map((t) => t.done)).toEqual([true, true]);
    expect(r.find("todos.toggle.t1").state.checked).toBe(true);
    await r.fire("todos.undo", { type: "click" });
    expect(board.get("todos").map((t) => t.done)).toEqual([false, true]);
    expect(r.state(view).todos.map((t) => t.done)).toEqual([false, true]);
    r.dispose();
  });
});

describe("todos.edit", () => {
  it("readOnly redirects to todos.index", async () => {
    const { ctx } = await simApi(3);
    await ctx.storage.set("todos.readOnly", "1");
    const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, state, ctx });
    expect(r.route().id).toBe("todos.index");
    r.dispose();
  });
  it("unknown todoId renders ListError", async () => {
    const { ctx } = await simApi();
    const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "nope" }, state, ctx });
    expect(r.find("todos.error.title").text).toBe("Not found");
    r.dispose();
  });
  it("duplicate title shows the api's keel.fields error; a fresh title saves and navigates to todos.list", async () => {
    const { ctx } = await simApi();
    const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, state, ctx });
    const title = controlId(r.a11y(), "Title");
    await r.fire(title, { type: "input", value: "Eggs" });
    await r.fire("todos.save", { type: "click" });
    expect(r.find(`${title}:error`).text).toBe("Another todo has this title");
    expect(r.route().id).toBe("todos.edit");
    await r.fire(title, { type: "input", value: "Oat milk" });
    await r.fire("todos.save", { type: "click" });
    expect(r.route().id).toBe("todos.list");
    expect(board.get("todos")[0]?.title).toBe("Oat milk");
    expect(r.state(view).todos[0]?.title).toBe("Oat milk");
    r.dispose();
  });
});
