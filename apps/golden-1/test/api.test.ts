import { createCtx } from "@keel/ctx";
import { properties, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import ActionApi from "../modules/api/ActionApi.ts";
import BoardApi from "../modules/api/BoardApi.ts";
import SuggestionsApi from "../modules/api/SuggestionsApi.ts";
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
    const r = await loadBoard.run({ params: {}, search: {} }, sim());
    expect(r).toEqual({ ok: true, value: { lists: [L], todos: [milk], canUndo: false } });
  });
  it("postList, postTodo, postToggle and postEdit commit with ctx-minted ids; postUndo undoes", async () => {
    expect(await postList.run({ name: "Work" }, { params: {} }, sim())).toEqual({ ok: true, value: null });
    const listId = board.get("lists")[0]?.id ?? "";
    expect((await postTodo.run({ title: "Milk", priority: "low" }, { params: { listId } }, sim())).ok).toBe(true);
    const todoId = board.get("todos")[0]?.id ?? "";
    expect((await postToggle.run({}, { params: { todoId } }, sim())).ok).toBe(true);
    expect((await postEdit.run({ title: "Oat milk", priority: "high" }, { params: { todoId } }, sim())).ok).toBe(true);
    expect(board.get("todos")).toMatchObject([{ listId, title: "Oat milk", priority: "high", done: true }]);
    expect((await postUndo.run({}, { params: {} }, sim())).ok).toBe(true);
    expect(board.get("todos")[0]?.title).toBe("Milk");
  });
  it("unknown ids are keel.notFound; a duplicate title is keel.fields; undo on an empty log is a no-op", async () => {
    seed({ lists: [L], todos: [milk, eggs] });
    const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? null : r.error?.code);
    expect(code(await postTodo.run({ title: "X", priority: "low" }, { params: { listId: "nope" } }, sim()))).toBe(
      "keel.notFound",
    );
    expect(code(await postToggle.run({}, { params: { todoId: "nope" } }, sim()))).toBe("keel.notFound");
    expect(code(await postEdit.run({ title: "X", priority: "low" }, { params: { todoId: "nope" } }, sim()))).toBe(
      "keel.notFound",
    );
    const dup = await postEdit.run({ title: "Eggs", priority: "low" }, { params: { todoId: "t1" } }, sim());
    expect(dup.ok ? null : dup.error).toMatchObject({
      code: "keel.fields",
      data: { title: "Another todo has this title" },
    });
    expect((await postUndo.run({}, { params: {} }, sim())).ok).toBe(true);
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
  it("every write endpoint commits and answers ok(null); undo reverts the last one", async () => {
    const app = await apiApp();
    const created = await app.fetch(post("/api/lists", { name: "Work" }));
    expect([created.status, await created.json()]).toEqual([200, { ok: true, value: null }]);
    const listId = board.get("lists")[0]?.id ?? "";
    expect((await app.fetch(post(`/api/lists/${listId}/todos`, { title: "Milk", priority: "low" }))).status).toBe(200);
    const todoId = board.get("todos")[0]?.id ?? "";
    expect((await app.fetch(post(`/api/todos/${todoId}/toggle`))).status).toBe(200);
    expect((await app.fetch(post(`/api/todos/${todoId}`, { title: "Oat milk", priority: "high" }))).status).toBe(200);
    const after = await lists(app);
    expect(after.results["api.lists"].value).toMatchObject({
      lists: [{ id: listId, name: "Work" }],
      todos: [{ id: todoId, title: "Oat milk", priority: "high", done: true }],
      canUndo: true,
    });
    expect((await app.fetch(post("/api/undo"))).status).toBe(200);
    expect((await lists(app)).results["api.lists"].value.todos[0]).toMatchObject({ title: "Milk", done: true });
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
    const first = await loadSuggestions.run({ params: {}, search: {} }, sim());
    expect(first.ok && first.value.map((x) => x.title)).toEqual(["Bread", "Eggs", "Milk"]);
    expect(await loadSuggestions.run({ params: {}, search: {} }, sim())).toEqual(first);
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
