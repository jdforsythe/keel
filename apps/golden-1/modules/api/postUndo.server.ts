import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/undo`: undo the board's last transaction when this caller (its `keel-caller` cookie) committed it (its
 * entry's `meta.caller`, k.store `undoWhere`); else nothing changes and the reply is `keel.denied` (403): one client
 * never undoes another's write.
 */
export const postUndo = action({ input: s.object({}), stores: boardStores }, (_input, { caller, stores }) =>
  stores.board.undoWhere((e) => e.meta?.caller === caller)
    ? ok(null)
    : err({ code: "keel.denied", message: "Nothing of yours to undo", data: {} }),
);
