import { createCtx } from "@keel/ctx";
import { properties } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { Board } from "../modules/todos/Board.schema.ts";
import { ListDraft } from "../modules/todos/ListDraft.schema.ts";
import { Suggestion } from "../modules/todos/Suggestion.schema.ts";
import { SuggestionsReply } from "../modules/todos/SuggestionsReply.schema.ts";
import { Todo } from "../modules/todos/Todo.schema.ts";
import { TodoDraft } from "../modules/todos/TodoDraft.schema.ts";
import { TodoList } from "../modules/todos/TodoList.schema.ts";
import { addList } from "../modules/todos/addList.ts";
import { addTodo } from "../modules/todos/addTodo.ts";
import { board } from "../modules/todos/board.ts";
import { createList } from "../modules/todos/createList.server.ts";
import { createTodo } from "../modules/todos/createTodo.server.ts";
import { editTodo } from "../modules/todos/editTodo.ts";
import { editable } from "../modules/todos/editable.guard.ts";
import { loadList } from "../modules/todos/loadList.server.ts";
import { loadTodo } from "../modules/todos/loadTodo.server.ts";
import { toggleTodo } from "../modules/todos/toggleTodo.ts";
import { updateTodo } from "../modules/todos/updateTodo.server.ts";
import "../modules/todos/routes.ts";

const base = board.snapshot();
afterEach(() => {
  expect(board.restore(base).ok).toBe(true);
});

const sim = () => createCtx({ mode: "sim", seed: 7 });
const seed = { lists: [{ id: "l1", name: "Home" }], todos: [] };

describe("schemas", () => {
  it("Board, TodoList and Todo accept the model and reject bad values", () => {
    expect(Board.parse({ lists: [], todos: [] }).ok).toBe(true);
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
});

describe("transactions keep the board invariant", () => {
  it("addList", async () => {
    await properties(addList);
  });
  it("addTodo", async () => {
    await properties(addTodo);
  });
  it("toggleTodo", async () => {
    await properties(toggleTodo);
  });
  it("editTodo", async () => {
    await properties(editTodo);
  });
});

describe("actions, loaders, guard", () => {
  it("createList adds a list with a ctx-minted id; undo restores the prior state", async () => {
    const ctx = sim();
    const r = await createList.run({ name: "Work" }, { params: {} }, ctx);
    expect(r.ok).toBe(true);
    expect(board.get("lists").map((l) => l.name)).toEqual(["Work"]);
    expect(board.undo()).toBe(true);
    expect(board.snapshot().state).toEqual({ lists: [], todos: [] });
  });
  it("createTodo adds an open todo to the list", async () => {
    expect((await createList.run({ name: "Home" }, { params: {} }, sim())).ok).toBe(true);
    const listId = board.get("lists")[0]?.id ?? "";
    const r = await createTodo.run({ title: "Milk", priority: "low" }, { params: { listId } }, sim());
    expect(r.ok).toBe(true);
    expect(board.get("todos")).toMatchObject([{ listId, title: "Milk", priority: "low", done: false }]);
  });
  it("updateTodo rejects a duplicate title with keel.fields and saves otherwise", async () => {
    expect(board.restore({ state: seed, log: [], initial: seed }).ok).toBe(true);
    const at = { params: { listId: "l1" } };
    const first = await createTodo.run({ title: "Milk", priority: "low" }, at, sim());
    const second = await createTodo.run({ title: "Eggs", priority: "low" }, at, createCtx({ mode: "sim", seed: 8 }));
    expect([first.ok, second.ok]).toEqual([true, true]);
    const [milk] = board.get("todos");
    const todoId = milk?.id ?? "";
    const dup = await updateTodo.run({ title: "Eggs", priority: "high" }, { params: { listId: "l1", todoId } }, sim());
    expect(dup.ok ? null : dup.error.code).toBe("keel.fields");
    const saved = await updateTodo.run(
      { title: "Oat milk", priority: "high" },
      { params: { listId: "l1", todoId } },
      sim(),
    );
    expect(saved.ok).toBe(true);
    expect(board.get("todos")[0]).toMatchObject({ title: "Oat milk", priority: "high" });
  });
  it("loadList and loadTodo return keel.notFound for unknown ids", async () => {
    expect(board.restore({ state: seed, log: [], initial: seed }).ok).toBe(true);
    const found = await loadList.run({ params: { listId: "l1" }, search: {} }, sim());
    expect(found.ok).toBe(true);
    const missing = await loadList.run({ params: { listId: "nope" }, search: {} }, sim());
    expect(missing.ok ? null : missing.error.code).toBe("keel.notFound");
    const todo = await loadTodo.run({ params: { listId: "l1", todoId: "nope" }, search: {} }, sim());
    expect(todo.ok ? null : todo.error.code).toBe("keel.notFound");
  });
  it("editable denies when ctx.storage todos.readOnly is 1", async () => {
    const ctx = sim();
    expect((await editable.run({ url: "/" }, ctx)).ok).toBe(true);
    await ctx.storage.set("todos.readOnly", "1");
    const denied = await editable.run({ url: "/" }, ctx);
    expect(denied.ok ? null : denied.error.code).toBe("keel.denied");
  });
});
