// Spec: std.conflicts, clause "In a snapshot with two rebased entries, one of a transaction whose function throws `new Error('sdk down')` and one that is an `order` race, `races` returns that `order` race and `{ store, id, reason: 'threw' }` for the first; with the function calling `defect('bug')` in place of the throw, `races` throws a value `isDefect` accepts."
// std.conflicts, API "`threw` when a transaction function throws any other `Error` (a dependency's failure) while `e`'s base or orders are applied: `e` is not judged and the analysis goes on. A defect, and a thrown value that is no `Error`, pass out of `races`."
// Seed 1337 (the titles are fixed; no generated input).
// Fixture: the snapshot is made by `boardStores`; `races` is given the same store with `editTodo` throwing for the title `boom`, so only the analysis meets the throw.
// The log: #1 add x, #2 add y, #3 edit y base 2, #4 edit y base 2 (rebased: an `order` race with #3), #5 edit x `boom` base 1 (rebased, after #4, so no order of #4 applies it).
import { defect, isDefect, s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { describe, expect, test } from "vitest";
import { STORE_ID, racesInRoot, snapshotOf } from "./fixtures.ts";

const Todo = s.object({ id: s.string(), title: s.string(), done: s.boolean() });
const BoardState = s.object({ todos: s.array(Todo) });

/** `api.board` as `boardStores` makes it, with `editTodo` running `fail` for the title `boom`. */
const failingStores = (fail: () => void) => (_ctx?: unknown) => {
  const board = store(BoardState, { todos: [] }, { id: STORE_ID });
  invariant(board, (st) => new Set(st.todos.map((t) => t.title)).size === st.todos.length);
  const addTodo = transaction(
    board,
    "api.addTodo",
    s.object({ id: s.string(), title: s.string() }),
    (st, p) => ({ todos: [...st.todos, { id: p.id, title: p.title, done: false }] }),
    { concurrent: "rebase" },
  );
  const editTodo = transaction(
    board,
    "api.editTodo",
    s.object({ id: s.string(), title: s.string() }),
    (st, p) => {
      if (p.title === "boom") fail();
      return { todos: st.todos.map((t) => (t.id === p.id ? { ...t, title: p.title } : t)) };
    },
    { concurrent: "rebase" },
  );
  const toggleTodo = transaction(
    board,
    "api.toggleTodo",
    s.object({ id: s.string() }),
    (st, p) => ({ todos: st.todos.map((t) => (t.id === p.id ? { ...t, done: !t.done } : t)) }),
    { concurrent: "rebase" },
  );
  return { board, addTodo, editTodo, toggleTodo };
};

const snap = () =>
  snapshotOf({}, [
    { t: "add", id: "x", title: "x" },
    { t: "add", id: "y", title: "y" },
    { t: "edit", id: "y", title: "p", base: 2 },
    { t: "edit", id: "y", title: "q", base: 2 },
    { t: "edit", id: "x", title: "boom", base: 1 },
  ]);

describe("std.conflicts: a transaction function that throws", () => {
  test("with the function throwing `new Error('sdk down')`, `races` returns the `order` race and `{ store, id, reason: 'threw' }` for the throwing entry", () => {
    const r = racesInRoot(
      snap(),
      failingStores(() => {
        throw new Error("sdk down");
      }),
    );
    expect(r.races).toHaveLength(1);
    expect(r.races[0]).toMatchObject({ kind: "order", entry: { id: 4 }, against: [{ id: 3 }] });
    expect(r.unchecked).toEqual([{ store: STORE_ID, id: 5, reason: "threw" }]);
  });

  test("with the function calling `defect('bug')` in place of the throw, `races` throws a value `isDefect` accepts", () => {
    let caught: unknown;
    try {
      racesInRoot(
        snap(),
        failingStores(() => defect("bug")),
      );
    } catch (e) {
      caught = e;
    }
    expect(isDefect(caught)).toBe(true);
  });
});
