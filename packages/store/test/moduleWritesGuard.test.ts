// k.server and k.resume Stores: while the installed module-write check refuses (a request runs), every operation that
// changes a module store's state throws and changes nothing: `tx`, `restore`, `undo` and `undoWhere`. A store made
// from a waiting `#k-state` snapshot is not a write.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { afterEach, describe, expect, it } from "vitest";
import { moduleWrites } from "../src/internal/moduleWrites.ts";
import { store } from "../src/store.ts";
import { transaction } from "../src/transaction.ts";
import { tx } from "../src/tx.ts";

const Rows = s.object({ rows: s.string() });
function make(id: string) {
  const board = store(Rows, { rows: "" }, { id });
  return { board, setRows: transaction(board, `${id}.set`, Rows, (_state, payload) => payload) };
}
const shared = (id: string): ReturnType<typeof make> => {
  const out: { made?: ReturnType<typeof make> } = {};
  scope(
    () => {
      out.made = make(id);
    },
    { detached: true },
  );
  if (out.made === undefined) throw new Error("fixture: store scope did not run");
  return out.made;
};
const refuse = (): void => {
  moduleWrites.check = (id) => {
    throw new Error(`E1256 write to module store ${id} during a request`);
  };
};

afterEach(() => {
  moduleWrites.check = null;
});

describe("the module-write check", () => {
  it("refuses restore, undo and undoWhere on a module store, changing nothing", async () => {
    const { board, setRows } = shared("mw.board");
    await tx(setRows, { rows: "a" });
    await tx(setRows, { rows: "b" });
    const before = board.snapshot();
    refuse();
    expect(() => board.restore({ state: { rows: "leak" }, log: [], initial: { rows: "leak" } })).toThrow(/^E1256/);
    expect(() => board.undo()).toThrow(/^E1256/);
    expect(() => board.undoWhere(() => true)).toThrow(/^E1256/);
    await expect(async () => tx(setRows, { rows: "c" })).rejects.toThrow(/^E1256/);
    moduleWrites.check = null;
    expect(board.snapshot()).toEqual(before);
    expect(board.get("rows")).toBe("b");
  });

  it("lets a store made from a waiting snapshot start from it", () => {
    const WAITING = Symbol.for("keel.waitingSnapshots");
    Reflect.set(
      globalThis,
      WAITING,
      new Map([["mw.waiting", { state: { rows: "served" }, log: [], initial: { rows: "served" } }]]),
    );
    refuse();
    try {
      expect(shared("mw.waiting").board.get("rows")).toBe("served");
    } finally {
      Reflect.deleteProperty(globalThis, WAITING);
    }
  });
});
