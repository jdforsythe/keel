import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { undoOwn } from "@keel/server";
import { board } from "./board.ts";

/**
 * `POST /api/undo`: undo the board's last transaction when this caller (its `keel-caller` cookie) committed it; else
 * nothing changes and the reply is `keel.denied` (403): one client never undoes another's write (finding 0082).
 */
export const postUndo = action({ input: s.object({}) }, () =>
  undoOwn(board) ? ok(null) : err({ code: "keel.denied", message: "Nothing of yours to undo", data: {} }),
);
