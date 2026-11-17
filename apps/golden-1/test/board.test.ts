// routes.ts first: the *.server.ts modules import it back (E1505 cycle otherwise).
import "../modules/todos/routes.ts";
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { drain } from "@keel/std-offline";
import { properties } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { Board } from "../modules/api/Board.schema.ts";
import { BoardView } from "../modules/api/BoardView.schema.ts";
import { ListDraft } from "../modules/api/ListDraft.schema.ts";
import { ListParams } from "../modules/api/ListParams.schema.ts";
import { Suggestion } from "../modules/api/Suggestion.schema.ts";
import { Todo } from "../modules/api/Todo.schema.ts";
import { TodoDraft } from "../modules/api/TodoDraft.schema.ts";
import { TodoList } from "../modules/api/TodoList.schema.ts";
import { FieldsReply } from "../modules/todos/FieldsReply.schema.ts";
import { TodoParams } from "../modules/todos/TodoParams.schema.ts";
import { WriteAnswer } from "../modules/todos/WriteAnswer.schema.ts";
import { WriteRefusal } from "../modules/todos/WriteRefusal.schema.ts";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { boardWrites } from "../modules/todos/boardWrites.service.ts";
import { createList } from "../modules/todos/createList.server.ts";
import { createTodo } from "../modules/todos/createTodo.server.ts";
import { editable } from "../modules/todos/editable.guard.ts";
import { hydrate } from "../modules/todos/hydrate.ts";
import { loadIndex } from "../modules/todos/loadIndex.server.ts";
import { loadList } from "../modules/todos/loadList.server.ts";
import { loadTodo } from "../modules/todos/loadTodo.server.ts";
import { refreshView } from "../modules/todos/refreshView.ts";
import { todos } from "../modules/todos/todos.service.ts";
import { todosApi } from "../modules/todos/todosApi.ts";
import { updateTodo } from "../modules/todos/updateTodo.server.ts";
import { view } from "../modules/todos/view.ts";
import { at, boardOf } from "./at.ts";
import { BOARD_KEY, apiCtx, readBoard, resetApi, seedBoard, simApi } from "./simApi.ts";

const Logged = s.object({
  log: s.array(s.object({ name: s.string(), base: s.int().optional(), key: s.string().optional() })),
});
/** The api's stored board log: each entry's name, base and key. */
async function apiBoardLog(): Promise<{ name: string; base?: number; key?: string }[]> {
  const raw = await apiCtx().storage.get(BOARD_KEY);
  const snap = Logged.parse(raw === null ? null : JSON.parse(raw));
  return snap.ok ? snap.value.log : [];
}
/** Microtask turns for an outbox flush to reach the api and settle; no timers. */
async function settled(): Promise<void> {
  for (let i = 0; i < 400; i++) await Promise.resolve();
}

const shown = view.snapshot();
const queued = boardOutbox.snapshot();
afterEach(() => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
  expect(boardOutbox.restore(queued).ok).toBe(true);
});

const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false } as const;
const seed = { lists: [L], todos: [milk] };
const seedServer = () => {
  const b = Board.parse(seed);
  if (!b.ok) throw new Error(b.error.message);
  return seedBoard(b.value);
};
const LISTS = new URL("/api/lists", location.href).href;
const UNDO = new URL("/api/undo", location.href).href;

describe("schemas", () => {
  it("Board, BoardView, TodoList and Todo accept the model and reject bad values", () => {
    expect(Board.parse({ lists: [], todos: [] }).ok).toBe(true);
    expect(BoardView.parse({ lists: [], todos: [], canUndo: false, head: 0 }).ok).toBe(true);
    expect(BoardView.parse({ lists: [], todos: [], canUndo: false }).ok).toBe(false);
    expect(BoardView.parse({ lists: [], todos: [], canUndo: false, head: -1 }).ok).toBe(false);
    expect(TodoList.parse({ id: "l1", name: "" }).ok).toBe(false);
    expect(Todo.parse({ id: "t1", listId: "l1", title: "Milk", priority: "urgent", done: false }).ok).toBe(false);
  });
  it("ListDraft, TodoDraft and Suggestion bound their strings", () => {
    expect(ListDraft.parse({ name: "x".repeat(61) }).ok).toBe(false);
    expect(TodoDraft.parse({ title: "Milk", priority: "high" }).ok).toBe(true);
    expect(TodoDraft.parse({ title: "", priority: "high" }).ok).toBe(false);
    expect(Suggestion.parse({ title: "Eggs" }).ok).toBe(true);
  });
  it("the todos endpoints answer the route values: the board, and an empty object", () => {
    const value = { lists: [L], todos: [], canUndo: true, head: 3 };
    expect(todos.lists.output.parse(value).ok).toBe(true);
    expect(todos.lists.output.parse({ id: "api.lists", results: { "api.lists": { ok: true, value } } }).ok).toBe(false);
    expect(todos.undo.output.parse({}).ok).toBe(true);
    expect(todos.undo.output.parse(null).ok).toBe(false);
  });
  it("the board writes decode the whole answer: { ok: true, value }, and a 422's keel.fields", () => {
    expect(WriteAnswer.parse({ ok: true, value: {} }).ok).toBe(true);
    expect(WriteAnswer.parse({ ok: true, value: "/lists/l1" }).ok).toBe(false);
    expect(WriteAnswer.parse(null).ok).toBe(false);
    expect(boardWrites.editTodo.output).toBe(WriteAnswer);
    const fields = { code: "keel.fields", message: "m", data: { title: "taken" } };
    expect(FieldsReply.parse(fields).ok).toBe(true);
    expect(WriteRefusal.parse({ ok: false, error: fields }).ok).toBe(true);
    expect(WriteRefusal.parse(fields).ok).toBe(false);
  });
});

describe("todos.view", () => {
  it("hydrate replaces the state for every generated payload", async () => {
    await properties(hydrate);
  });
  it("refreshView reads GET /api/lists into the view, with the board's head", async () => {
    await seedServer();
    const { ctx, sent } = await simApi();
    expect((await refreshView(ctx)).ok).toBe(true);
    expect(view.get("lists")).toEqual([L]);
    expect(view.get("head")).toBe(0);
    expect(sent).toEqual(["GET /api/lists"]);
  });
  it("a failed read leaves the view unchanged", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(LISTS, () => new Response("boom", { status: 500 }));
    const r = await refreshView(ctx);
    expect(r.ok ? null : r.error.code).toBe("api.status");
    expect(view.snapshot().state).toEqual(shown.state);
  });
});

describe("todos service", () => {
  it("sends accept and decodes the action's Result to its value", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const seen: string[] = [];
    ctx.net.route(UNDO, async (req) => {
      seen.push(`${req.method} ${req.headers.get("accept")}`);
      return new Response(JSON.stringify({ ok: true, value: {} }));
    });
    const r = await todosApi.undo({}, ctx);
    expect(r).toEqual({ ok: true, value: {} });
    expect(seen).toEqual(["POST application/json"]);
  });
});

describe("client loaders and actions (through the api deployable)", () => {
  it("loadIndex hydrates; loadList and loadTodo find by id or return keel.notFound", async () => {
    await seedServer();
    const { ctx } = await simApi();
    const index = await loadIndex.run(
      { params: {}, search: {}, url: location.href, caller: "c1", stores: undefined },
      ctx,
    );
    expect(index.ok && index.value.lists).toEqual([L]);
    expect(await loadList.run({ ...at(ListParams, { listId: "l1" }), search: {} }, ctx)).toEqual({
      ok: true,
      value: L,
    });
    const missing = await loadList.run({ ...at(ListParams, { listId: "nope" }), search: {} }, ctx);
    expect(missing.ok ? null : missing.error.code).toBe("keel.notFound");
    expect((await loadTodo.run({ ...at(TodoParams, { listId: "l1", todoId: "t1" }), search: {} }, ctx)).ok).toBe(true);
    const todo = await loadTodo.run({ ...at(TodoParams, { listId: "l1", todoId: "nope" }), search: {} }, ctx);
    expect(todo.ok ? null : todo.error.code).toBe("keel.notFound");
  });
  it("createList and createTodo send through the outbox with a key and the view's head, and answer ok(null)", async () => {
    const { ctx, sent } = await simApi();
    expect(
      await createList.run({ name: "Work" }, { params: {}, url: location.href, caller: "c1", stores: undefined }, ctx),
    ).toEqual({
      ok: true,
      value: null,
    });
    const listId = (await readBoard()).lists[0]?.id ?? "";
    const r = await createTodo.run({ title: "Milk", priority: "low" }, at(ListParams, { listId }), ctx);
    expect(r).toEqual({ ok: true, value: null });
    expect((await readBoard()).todos).toMatchObject([{ listId, title: "Milk", priority: "low", done: false }]);
    expect(sent).toEqual(["POST /api/lists", `POST /api/lists/${listId}/todos`]);
    expect(boardOutbox.get("entries")).toEqual([]);
    const log = await apiBoardLog();
    expect(log.map((e) => [e.name, e.base])).toEqual([
      ["api.addList", undefined],
      ["api.addTodo", 0],
    ]);
    expect(new Set(log.map((e) => e.key)).size).toBe(2);
  });
  it("createTodo on an unknown list returns the api 404 and leaves nothing in the outbox", async () => {
    const { ctx } = await simApi();
    const r = await createTodo.run({ title: "Milk", priority: "low" }, at(ListParams, { listId: "nope" }), ctx);
    expect(r.ok ? null : r.error).toMatchObject({ code: "api.status", data: { status: 404 } });
    expect(boardOutbox.get("entries")).toEqual([]);
  });
  it("updateTodo passes on the api's keel.fields and goes to the list on success", async () => {
    const both = Board.parse({ lists: [L], todos: [milk, { ...milk, id: "t2", title: "Eggs" }] });
    if (!both.ok) throw new Error(both.error.message);
    await seedBoard(both.value);
    const { ctx } = await simApi();
    const edit = at(TodoParams, { listId: "l1", todoId: "t1" });
    const dup = await updateTodo.run({ title: "Eggs", priority: "high" }, edit, ctx);
    expect(dup.ok ? null : dup.error).toMatchObject({
      code: "keel.fields",
      data: { title: "Another todo has this title" },
    });
    expect(await updateTodo.run({ title: "Oat milk", priority: "high" }, edit, ctx)).toEqual({
      ok: true,
      value: "/lists/l1",
    });
    expect((await readBoard()).todos[0]).toMatchObject({ title: "Oat milk", priority: "high" });
    expect(boardOutbox.get("entries")).toEqual([]);
  });
  it("offline, updateTodo queues the edit and goes to the list; back online, the outbox sends it", async () => {
    await seedServer();
    const { ctx, sent } = await simApi();
    ctx.net.setOnline(false);
    const edit = at(TodoParams, { listId: "l1", todoId: "t1" });
    expect(await updateTodo.run({ title: "Oat milk", priority: "high" }, edit, ctx)).toEqual({
      ok: true,
      value: "/lists/l1",
    });
    expect(boardOutbox.get("entries").map((e) => [e.endpoint, e.state, e.base])).toEqual([["editTodo", "queued", 0]]);
    expect(sent).toEqual([]);
    ctx.net.setOnline(true);
    const drained = scope(() => {
      void drain(ctx, boardOutbox);
    });
    await settled();
    drained.dispose();
    expect(sent).toEqual(["POST /api/todos/t1"]);
    expect(boardOutbox.get("entries")).toEqual([]);
    expect((await readBoard()).todos[0]).toMatchObject({ title: "Oat milk", priority: "high" });
  });
  it("editable denies when ctx.storage todos.readOnly is 1", async () => {
    const ctx = createCtx({ mode: "sim", seed: 7 });
    expect((await editable.run({ url: "/" }, ctx)).ok).toBe(true);
    await ctx.storage.set("todos.readOnly", "1");
    const denied = await editable.run({ url: "/" }, ctx);
    expect(denied.ok ? null : denied.error.code).toBe("keel.denied");
  });
});
