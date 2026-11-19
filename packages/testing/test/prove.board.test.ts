// golden-1's board store as written (apps/golden-1/modules/api), with the planned hideList and showList: the six
// transactions prove; addTodo without its duplicate-id check is E1716 with a state holding the payload's id; a
// filter-based purgeList is E1715 naming `.filter`.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import { describe, expect, it } from "vitest";

const LONG = 120_000;
const Priority = s.enum(["low", "normal", "high"]);
const TodoList = s.object({
  id: s.id("TodoList"),
  name: s.string({ min: 1, max: 60 }),
  hidden: s.boolean().optional(),
});
const Todo = s.object({
  id: s.id("Todo"),
  listId: s.id("TodoList"),
  title: s.string({ min: 1, max: 120 }),
  priority: Priority,
  done: s.boolean(),
});
const Board = s.object({ lists: s.array(TodoList), todos: s.array(Todo) });

let seq = 0;
const board = () => {
  seq += 1;
  const b = store(Board, { lists: [], todos: [] }, { id: `pb${seq}.board` });
  invariant(b, (state) => {
    const listIds = new Set(state.lists.map((l) => l.id));
    const todoIds = new Set(state.todos.map((t) => t.id));
    return (
      listIds.size === state.lists.length &&
      todoIds.size === state.todos.length &&
      state.todos.every((t) => listIds.has(t.listId))
    );
  });
  const addList = transaction(
    b,
    "api.addList",
    s.object({ id: s.id("TodoList"), name: s.string({ min: 1, max: 60 }) }),
    (state, p) =>
      state.lists.some((l) => l.id === p.id)
        ? state
        : { ...state, lists: [...state.lists, { id: p.id, name: p.name }] },
  );
  const todoPayload = s.object({
    id: s.id("Todo"),
    listId: s.id("TodoList"),
    title: s.string({ min: 1, max: 120 }),
    priority: Priority,
  });
  const addTodo = transaction(b, "api.addTodo", todoPayload, (state, p) =>
    state.todos.some((t) => t.id === p.id) || !state.lists.some((l) => l.id === p.listId)
      ? state
      : { ...state, todos: [...state.todos, { ...p, done: false }] },
  );
  const toggleTodo = transaction(b, "api.toggleTodo", s.object({ id: s.id("Todo") }), (state, p) =>
    state.todos.some((t) => t.id === p.id)
      ? { ...state, todos: state.todos.map((t) => (t.id === p.id ? { ...t, done: !t.done } : t)) }
      : state,
  );
  const editTodo = transaction(
    b,
    "api.editTodo",
    s.object({ id: s.id("Todo"), title: s.string({ min: 1, max: 120 }), priority: Priority }),
    (state, p) =>
      state.todos.some((t) => t.id === p.id)
        ? {
            ...state,
            todos: state.todos.map((t) => (t.id === p.id ? { ...t, title: p.title, priority: p.priority } : t)),
          }
        : state,
  );
  const hideList = transaction(b, "api.hideList", s.object({ id: s.id("TodoList") }), (state, p) =>
    state.lists.some((l) => l.id === p.id)
      ? { ...state, lists: state.lists.map((l) => (l.id === p.id ? { ...l, hidden: true } : l)) }
      : state,
  );
  const showList = transaction(b, "api.showList", s.object({ id: s.id("TodoList") }), (state, p) =>
    state.lists.some((l) => l.id === p.id)
      ? { ...state, lists: state.lists.map((l) => (l.id === p.id ? { ...l, hidden: false } : l)) }
      : state,
  );
  const planted = transaction(b, "api.addTodoUnchecked", todoPayload, (state, p) =>
    !state.lists.some((l) => l.id === p.listId) ? state : { ...state, todos: [...state.todos, { ...p, done: false }] },
  );
  const purgeList = transaction(b, "api.purgeList", s.object({ id: s.id("TodoList") }), (state, p) => ({
    lists: state.lists.filter((l) => l.id !== p.id),
    todos: state.todos.filter((t) => t.listId !== p.id),
  }));
  return { six: [addList, addTodo, toggleTodo, editTodo, hideList, showList], planted, purgeList };
};

const built = () => {
  let out: ReturnType<typeof board> | undefined;
  scope(() => {
    out = board();
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
};
const failure = async (run: () => Promise<unknown>): Promise<{ code?: unknown; message: string }> => {
  try {
    await run();
  } catch (e) {
    return e instanceof Error ? { code: Reflect.get(e, "code"), message: e.message } : { message: String(e) };
  }
  return { message: "resolved" };
};

describe("prove: golden-1's board", () => {
  it(
    "the six board transactions prove",
    async () => {
      const r = await prove(built().six);
      expect(r.proven).toEqual([
        "api.addList",
        "api.addTodo",
        "api.toggleTodo",
        "api.editTodo",
        "api.hideList",
        "api.showList",
      ]);
      expect(r.z3).toMatch(/^\d+\.\d+\.\d+$/);
    },
    LONG,
  );

  it(
    "addTodo without its duplicate-id check is E1716 with a state holding the payload's id",
    async () => {
      const f = await failure(() => prove([built().planted]));
      expect(f.code).toBe("E1716");
      const data: unknown = JSON.parse(f.message.split("\n")[1] ?? "null");
      expect(data).toEqual({
        transaction: "api.addTodoUnchecked",
        state: {
          lists: [{ id: "a", name: "b", hidden: false }],
          todos: [{ id: "c", listId: "a", title: "d", priority: "high", done: false }],
        },
        payload: { id: "c", listId: "a", title: "e", priority: "low" },
      });
    },
    LONG,
  );

  it(
    "purgeList, written with filter, is E1715 naming .filter",
    async () => {
      const f = await failure(() => prove([built().purgeList]));
      expect(f.code).toBe("E1715");
      expect(f.message).toContain("filter");
    },
    LONG,
  );
});
