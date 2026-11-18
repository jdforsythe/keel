import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { actionsOf, boardDiff, normalized } from "../smoke/shellReplay.mjs";

/** The inputs golden-1's shell session records, with the observations between them left out. */
const events = [
  { at: 0, kind: "nav", href: "/lists/l1" },
  { at: 0, kind: "tx", store: "todos.view", name: "todos.hydrate", payload: {} },
  { at: 1, kind: "fire", id: "todos.toggle.t1", event: { type: "change" } },
  { at: 2, kind: "nav", href: "/lists/l1/todos/t1/edit" },
  { at: 3, kind: "fire", id: "todos.editForm:title", event: { type: "input", value: "Oat milk" } },
  { at: 4, kind: "fire", id: "todos.save", event: { type: "click" } },
  { at: 4, kind: "fire", id: "todos.edit", event: { type: "submit" } },
  { at: 4, kind: "nav", href: "/lists/l1" },
  { at: 5, kind: "fire", id: "todos.addForm:title", event: { type: "input", value: "Eggs" } },
  { at: 6, kind: "fire", id: "todos.addTodo", event: { type: "click" } },
  { at: 6, kind: "fire", id: "todos.list", event: { type: "submit" } },
];

const UUID_A = "cc266a02-1170-48bb-b530-d89fca7b9f71";
const UUID_B = "8432f578-bf80-4f6c-937c-485590954203";
const board = (todo: string, key: string, caller: string, at: number) => ({
  head: 3,
  log: [{ id: 3, name: "api.addTodo", payload: { id: todo, title: "Eggs" }, at, meta: { caller }, key }],
  state: {
    todos: [
      { id: "t1", title: "Milk" },
      { id: todo, title: "Eggs" },
    ],
  },
  keys: [{ name: "api.addTodo", key }],
});

describe("actionsOf", () => {
  it("maps each input to a page action and leaves out the submit and route a click makes", () => {
    expect(actionsOf({ events })).toEqual([
      { kind: "nav", href: "/lists/l1" },
      { kind: "click", id: "todos.toggle.t1" },
      { kind: "nav", href: "/lists/l1/todos/t1/edit" },
      { kind: "type", id: "todos.editForm:title", value: "Oat milk" },
      { kind: "click", id: "todos.save" },
      { kind: "type", id: "todos.addForm:title", value: "Eggs" },
      { kind: "click", id: "todos.addTodo" },
    ]);
  });
  it("keeps a submit or route of its own time, and a nav after a nav", () => {
    expect(
      actionsOf({
        events: [
          { at: 0, kind: "nav", href: "/a" },
          { at: 0, kind: "nav", href: "/b" },
          { at: 1, kind: "fire", id: "f", event: { type: "submit" } },
        ],
      }),
    ).toEqual([
      { kind: "nav", href: "/a" },
      { kind: "nav", href: "/b" },
      { kind: "unsupported", event: { at: 1, kind: "fire", id: "f", event: { type: "submit" } } },
    ]);
  });
  it("presses known keys and marks what no page input makes", () => {
    const net = { at: 1, kind: "net", online: false };
    const focus = { at: 2, kind: "fire", id: "x", event: { type: "focus" } };
    const chord = { at: 3, kind: "fire", id: "x", event: { type: "keydown", key: "Enter", mod: true } };
    expect(
      actionsOf({
        events: [{ at: 0, kind: "fire", id: "x", event: { type: "keydown", key: "Enter" } }, net, focus, chord],
      }),
    ).toEqual([
      { kind: "keys", id: "x", keys: "" },
      { kind: "unsupported", event: net },
      { kind: "unsupported", event: focus },
      { kind: "unsupported", event: chord },
    ]);
  });
  it("is empty for a session without events", () => {
    expect(actionsOf(undefined)).toEqual([]);
    expect(actionsOf({ events: "x" })).toEqual([]);
  });
});

describe("normalized", () => {
  it("drops log times and numbers ids, keys and callers by first appearance", () => {
    expect(normalized(board(UUID_A, UUID_B, "c-one", 1))).toEqual({
      head: 3,
      keys: [{ key: "id#2", name: "api.addTodo" }],
      log: [
        {
          id: 3,
          key: "id#2",
          meta: { caller: "caller#1" },
          name: "api.addTodo",
          payload: { id: "id#1", title: "Eggs" },
        },
      ],
      state: {
        todos: [
          { id: "t1", title: "Milk" },
          { id: "id#1", title: "Eggs" },
        ],
      },
    });
  });
  it("gives one result for two runs that differ only in minted values and times", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), fc.string(), fc.nat(), (todo, key, caller, at) => {
        fc.pre(todo !== key);
        expect(JSON.stringify(normalized(board(todo, key, caller, at)))).toBe(
          JSON.stringify(normalized(board(UUID_A, UUID_B, "c-one", 1))),
        );
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
  it("keeps a difference in written values", () => {
    expect(normalized(board(UUID_A, UUID_B, "c", 1))).not.toEqual(
      normalized({ ...board(UUID_A, UUID_B, "c", 1), head: 4 }),
    );
  });
});

describe("boardDiff", () => {
  it("is empty for equal boards", () => {
    const b = normalized(board(UUID_A, UUID_B, "c", 1));
    expect(boardDiff(b, normalized(board(UUID_A, UUID_B, "d", 9)))).toEqual([]);
  });
  it("names each differing path with both values", () => {
    expect(
      boardDiff(
        { head: 4, state: { todos: [{ title: "Milk" }] } },
        { head: 5, state: { todos: [{ title: "Milk" }, { title: "Eggs" }] } },
      ),
    ).toEqual(["head: shell 4 sim 5", 'state.todos.1: shell (none) sim {"title":"Eggs"}']);
  });
  it("caps the lines and counts the rest", () => {
    const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${String(i).padStart(2, "0")}`, i]));
    const lines = boardDiff(many, {}, 10);
    expect(lines).toHaveLength(11);
    expect(lines.at(-1)).toBe("... +2 more");
  });
});
