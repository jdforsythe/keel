// @vitest-environment node
import { scope } from "@keel/reactive";
import { isolate } from "@keel/store";
import { prove } from "@keel/testing/prove";
import { afterAll, describe, expect, it } from "vitest";
import { addList } from "../modules/api/addList.ts";
import { addTodo } from "../modules/api/addTodo.ts";
import { board } from "../modules/api/board.ts";
import { editTodo } from "../modules/api/editTodo.ts";
import { hideList } from "../modules/api/hideList.ts";
import { showList } from "../modules/api/showList.ts";
import { toggleTodo } from "../modules/api/toggleTodo.ts";

// The board's invariant (ids unique, every todo in a known list) holds for every state and payload the schemas allow,
// by induction with Z3 (k.prove): the `proven` rung for these six transactions, beyond the bounded `board.explore`.
const sc = scope(() => undefined);
isolate(sc);
afterAll(() => sc.dispose());

describe("api.board proofs", () => {
  it("the six board transactions keep the invariant from every state it allows", async () => {
    const b = sc.run(board);
    const r = await prove([addList(b), addTodo(b), toggleTodo(b), editTodo(b), hideList(b), showList(b)]);
    expect([...r.proven].sort()).toEqual(
      ["api.addList", "api.addTodo", "api.editTodo", "api.hideList", "api.showList", "api.toggleTodo"].sort(),
    );
    expect(r.z3).toMatch(/^\d+\.\d+\.\d+$/);
  }, 60_000);
});
