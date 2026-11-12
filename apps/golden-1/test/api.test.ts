import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { isolate } from "@keel/store";
import { properties, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import type { Board } from "../modules/api/Board.schema.ts";
import { ListParams } from "../modules/api/ListParams.schema.ts";
import { TodoIdParams } from "../modules/api/TodoIdParams.schema.ts";
import { addList } from "../modules/api/addList.ts";
import { addTodo } from "../modules/api/addTodo.ts";
import { board } from "../modules/api/board.ts";
import { boardStores } from "../modules/api/boardStores.ts";
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
import { at, boardOf } from "./at.ts";
import { BOARD_KEY, apiApp, apiCtx, readBoard, resetApi, seedBoard } from "./simApi.ts";

const scopes: { dispose(): void }[] = [];
afterEach(() => {
  resetApi();
  for (const sc of scopes.splice(0)) sc.dispose();
});

/** Run `make` in a fresh isolated scope (k.store `isolate`), disposed after the test: ids never collide. */
const inScope = <T>(make: () => T): T => {
  const sc = scope(() => undefined);
  isolate(sc);
  scopes.push(sc);
  return sc.run(make);
};
/** One request's stores, as the node deployable builds them. */
const fresh = () => inScope(boardStores);
type Stores = ReturnType<typeof boardStores>;
/** What the router adds to a node-deployable `fn`: the caller and this request's stores. */
const as = (stores: Stores, caller = "c1") => ({ caller, stores });
const URL_ = "http://localhost/api/lists";
/** Entries in the api's stored board log. */
async function logLength(): Promise<number> {
  const raw = await apiCtx().storage.get(BOARD_KEY);
  const snap: unknown = raw === null ? null : JSON.parse(raw);
  if (typeof snap !== "object" || snap === null || !("log" in snap) || !Array.isArray(snap.log)) return -1;
  return snap.log.length;
}

const sim = () => createCtx({ mode: "sim", seed: 7 });
const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false } as const;
const eggs = { id: "t2", listId: "l1", title: "Eggs", priority: "low", done: true } as const;
/** `stores` seeded with `state` and no log. */
const seeded = (state: Board): Stores => {
  const st = fresh();
  expect(st.board.restore({ state, log: [], initial: state }).ok).toBe(true);
  return st;
};

const ORIGIN = "http://localhost";
const json = { accept: "application/json", "content-type": "application/json" };
const get = (path: string) => new Request(`${ORIGIN}${path}`, { headers: { accept: "application/json" } });
const post = (path: string, body: unknown = {}) =>
  new Request(`${ORIGIN}${path}`, { method: "POST", headers: json, body: JSON.stringify(body) });
const lists = async (app: Awaited<ReturnType<typeof apiApp>>) => await (await app.fetch(get("/api/lists"))).json();

describe("api.board", () => {
  it("transactions keep the invariant for generated payloads", async () => {
    await properties(addList(inScope(board)));
    await properties(addTodo(inScope(board)));
    await properties(toggleTodo(inScope(board)));
    await properties(editTodo(inScope(board)));
  });
  it("the invariant rejects a todo in an unknown list and duplicate ids", () => {
    const { board } = fresh();
    expect(board.check({ lists: [L], todos: [milk] }).ok).toBe(true);
    const orphan = board.check({ lists: [], todos: [milk] });
    expect(orphan.ok ? null : orphan.error.code).toBe("store.invariant");
    expect(board.check({ lists: [L, L], todos: [] }).ok).toBe(false);
  });
});

describe("loaders and actions", () => {
  it("loadBoard serves lists, todos and canUndo", async () => {
    const st = seeded(boardOf({ lists: [L], todos: [milk] }));
    const r = await loadBoard.run({ params: {}, search: {}, url: URL_, ...as(st) }, sim());
    expect(r).toEqual({ ok: true, value: { lists: [L], todos: [milk], canUndo: false } });
  });
  it("postList, postTodo, postToggle and postEdit commit with ctx-minted ids; postUndo refuses another caller", async () => {
    const st = fresh();
    const a = as(st, "a");
    expect(await postList.run({ name: "Work" }, { params: {}, url: URL_, ...a }, sim())).toEqual({
      ok: true,
      value: null,
    });
    const listId = st.board.get("lists")[0]?.id ?? "";
    expect(
      (await postTodo.run({ title: "Milk", priority: "low" }, { ...at(ListParams, { listId }), ...a }, sim())).ok,
    ).toBe(true);
    const todoId = st.board.get("todos")[0]?.id ?? "";
    expect((await postToggle.run({}, { ...at(TodoIdParams, { todoId }), ...a }, sim())).ok).toBe(true);
    const edited = await postEdit.run(
      { title: "Oat milk", priority: "high" },
      { ...at(TodoIdParams, { todoId }), ...a },
      sim(),
    );
    expect(edited.ok).toBe(true);
    expect(st.board.get("todos")).toMatchObject([{ listId, title: "Oat milk", priority: "high", done: true }]);
    // Undo is scoped to the caller that committed the write: another caller is denied, the writer succeeds.
    const undoUrl = "http://localhost/api/undo";
    const refused = await postUndo.run({}, { params: {}, url: undoUrl, ...as(st, "b") }, sim());
    expect(refused.ok ? null : refused.error.code).toBe("keel.denied");
    expect(st.board.get("todos")[0]?.title).toBe("Oat milk");
    expect((await postUndo.run({}, { params: {}, url: undoUrl, ...a }, sim())).ok).toBe(true);
    expect(st.board.get("todos")[0]?.title).toBe("Milk");
  });
  it("unknown ids are keel.notFound; a duplicate title is keel.fields; undo with nothing of the caller's is keel.denied", async () => {
    const st = seeded(boardOf({ lists: [L], todos: [milk, eggs] }));
    const a = as(st);
    const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? null : r.error?.code);
    expect(
      code(await postTodo.run({ title: "X", priority: "low" }, { ...at(ListParams, { listId: "nope" }), ...a }, sim())),
    ).toBe("keel.notFound");
    expect(code(await postToggle.run({}, { ...at(TodoIdParams, { todoId: "nope" }), ...a }, sim()))).toBe(
      "keel.notFound",
    );
    expect(
      code(
        await postEdit.run({ title: "X", priority: "low" }, { ...at(TodoIdParams, { todoId: "nope" }), ...a }, sim()),
      ),
    ).toBe("keel.notFound");
    const dup = await postEdit.run(
      { title: "Eggs", priority: "low" },
      { ...at(TodoIdParams, { todoId: "t1" }), ...a },
      sim(),
    );
    expect(dup.ok ? null : dup.error).toMatchObject({
      code: "keel.fields",
      data: { title: "Another todo has this title" },
    });
    expect(code(await postUndo.run({}, { params: {}, url: "http://localhost/api/undo", ...a }, sim()))).toBe(
      "keel.denied",
    );
    expect(st.board.get("todos")).toEqual([milk, eggs]);
  });
});

describe("api deployable over HTTP (createApp fetch, runtime JSON)", () => {
  it("GET /api/lists is the api.lists Result", async () => {
    await seedBoard(boardOf({ lists: [L], todos: [milk] }));
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
    // The first write sets the caller cookie (the cookie is the undo scope); this client sends it back, as a browser would.
    const cookie = created.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(cookie).toMatch(/^keel-caller=/);
    const mine = (req: Request) => {
      req.headers.set("cookie", cookie);
      return app.fetch(req);
    };
    const listId = (await readBoard()).lists[0]?.id ?? "";
    expect((await mine(post(`/api/lists/${listId}/todos`, { title: "Milk", priority: "low" }))).status).toBe(200);
    const todoId = (await readBoard()).todos[0]?.id ?? "";
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
  it("after 50 writes the served document and JSON name no transaction", async () => {
    const app = await apiApp();
    for (let i = 0; i < 50; i++) expect((await app.fetch(post("/api/lists", { name: `L${i}` }))).status).toBe(200);
    expect(await logLength()).toBe(50);
    const html = await (
      await app.fetch(new Request(`${ORIGIN}/api/lists`, { headers: { accept: "text/html" } }))
    ).text();
    expect(JSON.parse(html).id).toBe("api.lists");
    expect(html).not.toContain("api.board");
    expect(html).not.toContain("api.addList");
    expect(JSON.stringify(await lists(app))).not.toContain("api.addList");
  });
  it("bad bodies are 422 keel.fields; unknown ids are 404; a duplicate title is 422 with the field", async () => {
    await seedBoard(boardOf({ lists: [L], todos: [milk, eggs] }));
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
    expect((await readBoard()).todos).toEqual([milk, eggs]);
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

describe("api routes", () => {
  it("loadSuggestions returns the same sorted titles on every call", async () => {
    const first = await loadSuggestions.run(
      { params: {}, search: {}, url: "http://localhost/api/suggestions", caller: "c1", stores: undefined },
      sim(),
    );
    expect(first.ok && first.value.map((x) => x.title)).toEqual(["Bread", "Eggs", "Milk"]);
    expect(
      await loadSuggestions.run(
        { params: {}, search: {}, url: "http://localhost/api/suggestions", caller: "c1", stores: undefined },
        sim(),
      ),
    ).toEqual(first);
  });
  it("API routes have no view: accept text/html still gets JSON, a GET without a loader is 405", async () => {
    expect(routes.routes["api.lists"]).toMatchObject({ api: true });
    expect("component" in routes.routes["api.undo"]).toBe(false);
    await seedBoard(boardOf({ lists: [L], todos: [] }));
    const app = await apiApp();
    const doc = await app.fetch(new Request(`${ORIGIN}/api/lists`, { headers: { accept: "text/html" } }));
    expect([doc.status, doc.headers.get("content-type")?.startsWith("application/json")]).toEqual([200, true]);
    expect((await doc.json()).results["api.lists"].value.lists[0].name).toBe("Home");
    const undo = await app.fetch(new Request(`${ORIGIN}/api/undo`, { headers: { accept: "text/html" } }));
    expect([undo.status, undo.headers.get("allow")]).toEqual([405, "POST"]);
  });
});
