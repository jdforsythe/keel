import { scope } from "@keel/reactive";
import { isolate } from "@keel/store";
import { explore } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { addList } from "../modules/api/addList.ts";
import { addTodo } from "../modules/api/addTodo.ts";
import { board } from "../modules/api/board.ts";
import { editTodo } from "../modules/api/editTodo.ts";
import { toggleTodo } from "../modules/api/toggleTodo.ts";
import { boardOf } from "./at.ts";

const scopes: { dispose(): void }[] = [];
afterEach(() => {
  for (const sc of scopes.splice(0)) sc.dispose();
});

/** A fresh `api.board` with the four `api.*` transactions bound to it, in an isolated scope disposed after the test. */
function bound() {
  const sc = scope(() => undefined);
  isolate(sc);
  scopes.push(sc);
  return sc.run(() => {
    const b = board();
    return { b, txs: [addList(b), addTodo(b), toggleTodo(b), editTodo(b)] };
  });
}

/** The race proof's board: Home with Milk (t1) and Bread (t2). */
const fixture = boardOf({
  lists: [{ id: "l1", name: "Home" }],
  todos: [
    { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false },
    { id: "t2", listId: "l1", title: "Bread", priority: "normal", done: false },
  ],
});

/** Two ids per kind (one the fixture holds, one it does not), two titles and two priorities. */
const TODO_IDS = ["t1", "t3"];
const TITLES = ["Eggs", "Oat milk"];
const PRIORITIES = ["low", "high"];
const fields = TODO_IDS.flatMap((id) =>
  TITLES.flatMap((title) => PRIORITIES.map((priority) => ({ id, title, priority }))),
);
const payloads = {
  "api.addList": [
    { id: "l1", name: "Home" },
    { id: "l2", name: "Shop" },
  ],
  "api.addTodo": fields.map((f) => ({ ...f, listId: "l1" })),
  "api.toggleTodo": TODO_IDS.map((id) => ({ id })),
  "api.editTodo": fields,
};

describe("api.board explored from the race fixture", () => {
  it("every state within 3 writes keeps the invariant: ids unique, every todo in a known list", () => {
    const { b, txs } = bound();
    const before = b.snapshot({ meta: true });
    const r = explore(txs, { from: fixture, payloads, depth: 3 });
    expect(r.states[0]).toEqual(fixture);
    expect(r.depth).toBe(3);
    expect([r.states.length, r.edges]).toEqual([112, 960]);
    expect(b.snapshot({ meta: true })).toEqual(before);
  });

  it("two runs over the same arguments return the same result", () => {
    const { txs } = bound();
    expect(explore(txs, { from: fixture, payloads, depth: 2 })).toEqual(
      explore(txs, { from: fixture, payloads, depth: 2 }),
    );
  });
});
