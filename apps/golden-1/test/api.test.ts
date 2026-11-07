import { createCtx } from "@keel/ctx";
import { properties, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import ActionApi from "../modules/api/ActionApi.ts";
import BoardApi from "../modules/api/BoardApi.ts";
import SuggestionsApi from "../modules/api/SuggestionsApi.ts";
import { TodoIdParams } from "../modules/api/TodoIdParams.schema.ts";
import { addList } from "../modules/api/addList.ts";
import { addTodo } from "../modules/api/addTodo.ts";
import { board } from "../modules/api/board.ts";
import { editTodo } from "../modules/api/editTodo.ts";
import { loadBoard } from "../modules/api/loadBoard.server.ts";
import { loadSuggestions } from "../modules/api/loadSuggestions.server.ts";
import { postEdit } from "../modules/api/postEdit.server.ts";
import { postList } from "../modules/api/postList.server.ts";
import { postTodo } from "../modules/api/postTodo.server.ts";
import { postToggle } from "../modules/api/postToggle.server.ts";
import { postUndo } from "../modules/api/postUndo.server.ts";
import { routes } from "../modules/api/routes.ts";
import { toggleTodo } from "../modules/api/toggleTodo.ts";
import { ListParams } from "../modules/todos/ListParams.schema.ts";
import { at } from "./at.ts";
import { apiApp } from "./simApi.ts";

const base = board.snapshot();
afterEach(() => {
  expect(board.restore(base).ok).toBe(true);
});

const sim = () => createCtx({ mode: "sim", seed: 7 });
const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false } as const;
const eggs = { id: "t2", listId: "l1", title: "Eggs", priority: "low", done: true } as const;
const seed = (state: { lists: (typeof L)[]; todos: (typeof milk | typeof eggs)[] }) =>
  expect(board.restore({ state, log: [], initial: state }).ok).toBe(true);

const ORIGIN = "http://localhost";
const json = { accept: "application/json", "content-type": "application/json" };
const get = (path: string) => new Request(`${ORIGIN}${path}`, { headers: { accept: "application/json" } });
const post = (path: string, body: unknown = {}) =>
  new Request(`${ORIGIN}${path}`, { method: "POST", headers: json, body: JSON.stringify(body) });
const lists = async (app: Awaited<ReturnType<typeof apiApp>>) => await (await app.fetch(get("/api/lists"))).json();

describe("api.board", () => {
  it("transactions keep the invariant for generated payloads", async () => {
    await properties(addList);
    await properties(addTodo);
    await properties(toggleTodo);
    await properties(editTodo);
  });
  it("the invariant rejects a todo in an unknown list and duplicate ids", () => {
    expect(board.check({ lists: [L], todos: [milk] }).ok).toBe(true);
    const orphan = board.check({ lists: [], todos: [milk] });
    expect(orphan.ok ? null : orphan.error.code).toBe("store.invariant");
    expect(board.check({ lists: [L, L], todos: [] }).ok).toBe(false);
  });
});

describe("loaders and actions", () => {
  it("loadBoard serves lists, todos and canUndo", async () => {
    seed({ lists: [L], todos: [milk] });
    const r = await loadBoard.run({ params: {}, search: {}, url: "http://localhost/api/lists" }, sim());
    expect(r).toEqual({ ok: true, value: { lists: [L], todos: [milk], canUndo: false } });
  });
  it("postList, postTodo, postToggle and postEdit commit with ctx-minted ids; postUndo outside a request is refused", async () => {
    expect(await postList.run({ name: "Work" }, { params: {}, url: "http://localhost/api/lists" }, sim())).toEqual({
      ok: true,
      value: null,
    });
    const listId = board.get("lists")[0]?.id ?? "";
    expect((await postTodo.run({ title: "Milk", priority: "low" }, at(ListParams, { listId }), sim())).ok).toBe(true);
    const todoId = board.get("todos")[0]?.id ?? "";
    expect((await postToggle.run({}, at(TodoIdParams, { todoId }), sim())).ok).toBe(true);
    const edited = await postEdit.run({ title: "Oat milk", priority: "high" }, at(TodoIdParams, { todoId }), sim());
    expect(edited.ok).toBe(true);
    expect(board.get("todos")).toMatchObject([{ listId, title: "Oat milk", priority: "high", done: true }]);
    // No request, so no caller: undo is scoped to the caller that committed the write (finding 0082).
    const refused = await postUndo.run({}, { params: {}, url: "http://localhost/api/undo" }, sim());
    expect(refused.ok ? null : refused.error.code).toBe("keel.denied");
    expect(board.get("todos")[0]?.title).toBe("Oat milk");
  });
  it("unknown ids are keel.notFound; a duplicate title is keel.fields; undo with nothing of the caller's is keel.denied", async () => {
    seed({ lists: [L], todos: [milk, eggs] });
    const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? null : r.error?.code);
    expect(code(await postTodo.run({ title: "X", priority: "low" }, at(ListParams, { listId: "nope" }), sim()))).toBe(
      "keel.notFound",
    );
    expect(code(await postToggle.run({}, at(TodoIdParams, { todoId: "nope" }), sim()))).toBe("keel.notFound");
    expect(code(await postEdit.run({ title: "X", priority: "low" }, at(TodoIdParams, { todoId: "nope" }), sim()))).toBe(
      "keel.notFound",
    );
    const dup = await postEdit.run({ title: "Eggs", priority: "low" }, at(TodoIdParams, { todoId: "t1" }), sim());
    expect(dup.ok ? null : dup.error).toMatchObject({
      code: "keel.fields",
      data: { title: "Another todo has this title" },
    });
    expect(code(await postUndo.run({}, { params: {}, url: "http://localhost/api/undo" }, sim()))).toBe("keel.denied");
    expect(board.get("todos")).toEqual([milk, eggs]);
  });
});

describe("api deployable over HTTP (createApp fetch, runtime JSON)", () => {
  it("GET /api/lists is the api.lists Result", async () => {
    seed({ lists: [L], todos: [milk] });
    const app = await apiApp();
    const res = await app.fetch(get("/api/lists"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "api.lists",
      results: { "api.lists": { ok: true, value: { lists: [L], todos: [milk], canUndo: false } } },
    });
  });
  it("every write endpoint commits and answers ok(null); undo reverts the caller's last one only", async () => {
    const app = await apiApp();
    const created = await app.fetch(post("/api/lists", { name: "Work" }));
    expect([created.status, await created.json()]).toEqual([200, { ok: true, value: null }]);
    // The first write sets the caller cookie (finding 0082); this client sends it back, as a browser would.
    const cookie = created.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(cookie).toMatch(/^keel-caller=/);
    const mine = (req: Request) => {
      req.headers.set("cookie", cookie);
      return app.fetch(req);
    };
    const listId = board.get("lists")[0]?.id ?? "";
    expect((await mine(post(`/api/lists/${listId}/todos`, { title: "Milk", priority: "low" }))).status).toBe(200);
    const todoId = board.get("todos")[0]?.id ?? "";
    expect((await mine(post(`/api/todos/${todoId}/toggle`))).status).toBe(200);
    expect((await mine(post(`/api/todos/${todoId}`, { title: "Oat milk", priority: "high" }))).status).toBe(200);
    const after = await (await mine(get("/api/lists"))).json();
    expect(after.results["api.lists"].value).toMatchObject({
      lists: [{ id: listId, name: "Work" }],
      todos: [{ id: todoId, title: "Oat milk", priority: "high", done: true }],
      canUndo: true,
    });
    expect((await lists(app)).results["api.lists"].value.canUndo).toBe(false);
    expect((await app.fetch(post("/api/undo"))).status).toBe(403);
    expect((await mine(post("/api/undo"))).status).toBe(200);
    expect((await lists(app)).results["api.lists"].value.todos[0]).toMatchObject({ title: "Milk", done: true });
  });
  it("after 50 writes the served document and JSON name no transaction (finding 0082)", async () => {
    const app = await apiApp();
    for (let i = 0; i < 50; i++) expect((await app.fetch(post("/api/lists", { name: `L${i}` }))).status).toBe(200);
    expect(board.log()).toHaveLength(50);
    const html = await (
      await app.fetch(new Request(`${ORIGIN}/api/lists`, { headers: { accept: "text/html" } }))
    ).text();
    expect(html).toContain('"api.board":{"state":');
    expect(html).toContain('"log":[]');
    expect(html).not.toContain("api.addList");
    expect(JSON.stringify(await lists(app))).not.toContain("api.addList");
  });
  it("bad bodies are 422 keel.fields; unknown ids are 404; a duplicate title is 422 with the field", async () => {
    seed({ lists: [L], todos: [milk, eggs] });
    const app = await apiApp();
    const bad = await app.fetch(post("/api/lists", { name: "" }));
    expect([bad.status, (await bad.json()).error.code]).toEqual([422, "keel.fields"]);
    expect((await app.fetch(post("/api/lists/nope/todos", { title: "X", priority: "low" }))).status).toBe(404);
    expect((await app.fetch(post("/api/todos/nope/toggle"))).status).toBe(404);
    const dup = await app.fetch(post("/api/todos/t1", { title: "Eggs", priority: "low" }));
    expect([dup.status, (await dup.json()).error]).toEqual([
      422,
      { code: "keel.fields", message: "Duplicate title", data: { title: "Another todo has this title" } },
    ]);
    expect(board.get("todos")).toEqual([milk, eggs]);
  });
  it("GET /api/suggestions is the api.suggestions Result", async () => {
    const res = await (await apiApp()).fetch(get("/api/suggestions"));
    expect((await res.json()).results["api.suggestions"].value).toEqual([
      { title: "Bread" },
      { title: "Eggs" },
      { title: "Milk" },
    ]);
  });
});

describe("api route components", () => {
  it("loadSuggestions returns the same sorted titles on every call", async () => {
    const first = await loadSuggestions.run({ params: {}, search: {}, url: "http://localhost/api/suggestions" }, sim());
    expect(first.ok && first.value.map((x) => x.title)).toEqual(["Bread", "Eggs", "Milk"]);
    expect(
      await loadSuggestions.run({ params: {}, search: {}, url: "http://localhost/api/suggestions" }, sim()),
    ).toEqual(first);
  });
  it("SuggestionsApi, BoardApi and ActionApi render the document views", async () => {
    expect([routes.routes["api.suggestions"].component, routes.routes["api.lists"].component]).toEqual([
      SuggestionsApi,
      BoardApi,
    ]);
    expect(routes.routes["api.undo"].component).toBe(ActionApi);
    const s = await renderRoute("api.suggestions", { routes });
    expect(s.find("api.suggestions").text).toBe("BreadEggsMilk");
    s.dispose();
    const b = await renderRoute("api.lists", { routes, state: [[board, { lists: [L], todos: [] }]] });
    expect(b.find("api.lists").text).toBe("Home");
    b.dispose();
    const a = await renderRoute("api.undo", { routes });
    expect(a.find("api.action").text).toBe("POST only");
    a.dispose();
  });
});
