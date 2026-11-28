// A module store and its transaction, shared by the k.resume store suites (not a test file).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";

export const Rows = s.object({ rows: s.string() });

function make() {
  // `store()` runs inside a reactive scope (E1203); this one is never disposed and is not isolated, so the store sits in the module registry.
  const board = store(Rows, { rows: "" }, { id: "rm.board" });
  const setRows = transaction(board, "rm.setRows", Rows, (_state, payload) => payload);
  return { board, setRows };
}

let made: ReturnType<typeof make> | undefined;
scope(
  () => {
    made = make();
  },
  { detached: true },
);
if (made === undefined) throw new Error("fixture: store scope did not run");

/** A module-level store: it sits in the module registry of the graph that evaluates this file. */
export const { board, setRows } = made;

/** The state a test restores `board` to. */
export const PRISTINE = board.snapshot();
