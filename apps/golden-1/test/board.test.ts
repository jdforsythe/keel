// routes.ts first: the *.server.ts modules import it back (E1505 cycle otherwise).
import "../modules/todos/routes.ts";
import { type Ctx, createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { service } from "@keel/services";
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
import { ActionReply } from "../modules/todos/ActionReply.schema.ts";
import { BoardReply } from "../modules/todos/BoardReply.schema.ts";
import { FieldsReply } from "../modules/todos/FieldsReply.schema.ts";
import { SuggestionsReply } from "../modules/todos/SuggestionsReply.schema.ts";
import { TodoParams } from "../modules/todos/TodoParams.schema.ts";
import { createList } from "../modules/todos/createList.server.ts";
import { createTodo } from "../modules/todos/createTodo.server.ts";
import { editable } from "../modules/todos/editable.guard.ts";
import { hydrate } from "../modules/todos/hydrate.ts";
import { loadIndex } from "../modules/todos/loadIndex.server.ts";
import { loadList } from "../modules/todos/loadList.server.ts";
import { loadTodo } from "../modules/todos/loadTodo.server.ts";
import { refreshView } from "../modules/todos/refreshView.ts";
import { syncAfter } from "../modules/todos/syncAfter.ts";
import { todos } from "../modules/todos/todos.service.ts";
import { todosApi } from "../modules/todos/todosApi.ts";
import { updateTodo } from "../modules/todos/updateTodo.server.ts";
import { view } from "../modules/todos/view.ts";
import { at, boardOf } from "./at.ts";
import { readBoard, resetApi, seedBoard, simApi } from "./simApi.ts";

const shown = view.snapshot();
afterEach(() => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
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
/** `todos.toggleTodo` for `t1`: params parse into the branded id the endpoint takes. */
const T1 = s.object({ todoId: s.id("Todo") }).parse({ todoId: milk.id });
const toggleT1 = (ctx: Ctx) => (T1.ok ? todosApi.toggleTodo({ params: T1.value }, ctx) : Promise.resolve(T1));

describe("schemas", () => {
  it("Board, BoardView, TodoList and Todo accept the model and reject bad values", () => {
    expect(Board.parse({ lists: [], todos: [] }).ok).toBe(true);
    expect(BoardView.parse({ lists: [], todos: [], canUndo: false }).ok).toBe(true);
    expect(BoardView.parse({ lists: [], todos: [] }).ok).toBe(false);
    expect(TodoList.parse({ id: "l1", name: "" }).ok).toBe(false);
    expect(Todo.parse({ id: "t1", listId: "l1", title: "Milk", priority: "urgent", done: false }).ok).toBe(false);
  });
  it("ListDraft, TodoDraft and Suggestion bound their strings; SuggestionsReply is the api.suggestions Result", () => {
    expect(ListDraft.parse({ name: "x".repeat(61) }).ok).toBe(false);
    expect(TodoDraft.parse({ title: "Milk", priority: "high" }).ok).toBe(true);
    expect(TodoDraft.parse({ title: "", priority: "high" }).ok).toBe(false);
    expect(Suggestion.parse({ title: "Eggs" }).ok).toBe(true);
    const reply = { id: "api.suggestions", results: { "api.suggestions": { ok: true, value: [{ title: "Eggs" }] } } };
    expect(SuggestionsReply.parse(reply).ok).toBe(true);
    expect(SuggestionsReply.parse([{ title: "Eggs" }]).ok).toBe(false);
  });
  it("BoardReply, ActionReply and FieldsReply are the api runtime bodies", () => {
    const value = { lists: [L], todos: [], canUndo: true };
    expect(BoardReply.parse({ id: "api.lists", results: { "api.lists": { ok: true, value } } }).ok).toBe(true);
    expect(BoardReply.parse({ id: "api.lists", results: { "api.lists": { ok: false, value } } }).ok).toBe(false);
    expect(ActionReply.parse({ ok: true, value: null }).ok).toBe(true);
    expect(ActionReply.parse({ ok: false, value: null }).ok).toBe(false);
    const fields = { ok: false, error: { code: "keel.fields", message: "m", data: { title: "taken" } } };
    expect(FieldsReply.parse(fields).ok).toBe(true);
  });
});

describe("todos.view", () => {
  it("hydrate replaces the state for every generated payload", async () => {
    await properties(hydrate);
  });
  it("refreshView reads GET /api/lists into the view; syncAfter writes then refreshes", async () => {
    await seedServer();
    const { ctx, sent } = await simApi();
    expect((await refreshView(ctx)).ok).toBe(true);
    expect(view.get("lists")).toEqual([L]);
    const r = await syncAfter(ctx, toggleT1(ctx));
    expect(r.ok && r.value.todos[0]?.done).toBe(true);
    expect(view.get("todos")[0]?.done).toBe(true);
    expect(view.get("canUndo")).toBe(true);
    expect(sent).toEqual(["GET /api/lists", "POST /api/todos/t1/toggle", "GET /api/lists"]);
  });
  it("a failed write is returned and nothing is re-read", async () => {
    const { ctx, sent } = await simApi();
    const r = await syncAfter(ctx, toggleT1(ctx));
    expect(r.ok ? null : r.error).toMatchObject({ code: "api.status", data: { status: 404 } });
    expect(sent).toEqual(["POST /api/todos/t1/toggle"]);
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
  it("sends accept and a JSON body, and decodes the Result", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const seen: string[] = [];
    ctx.net.route(LISTS, async (req) => {
      seen.push(`${req.headers.get("accept")} ${req.headers.get("content-type")} ${await req.text()}`);
      return new Response(JSON.stringify({ ok: true, value: null }));
    });
    const r = await service({ module: "api", schema: todos }).createList({ body: { name: "Work" } }, ctx);
    expect(r).toEqual({ ok: true, value: { ok: true, value: null } });
    expect(seen).toEqual(['application/json application/json {"name":"Work"}']);
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
  it("createList and createTodo post to the api and answer ok(null)", async () => {
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
  });
  it("createTodo on an unknown list returns the api 404", async () => {
    const { ctx } = await simApi();
    const r = await createTodo.run({ title: "Milk", priority: "low" }, at(ListParams, { listId: "nope" }), ctx);
    expect(r.ok ? null : r.error).toMatchObject({ code: "api.status", data: { status: 404 } });
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
  });
  it("editable denies when ctx.storage todos.readOnly is 1", async () => {
    const ctx = createCtx({ mode: "sim", seed: 7 });
    expect((await editable.run({ url: "/" }, ctx)).ok).toBe(true);
    await ctx.storage.set("todos.readOnly", "1");
    const denied = await editable.run({ url: "/" }, ctx);
    expect(denied.ok ? null : denied.error.code).toBe("keel.denied");
  });
});
