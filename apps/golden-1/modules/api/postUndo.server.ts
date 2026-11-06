import { action } from "@keel/router";
import { ok, s } from "@keel/schema";
import { board } from "./board.ts";

/** `POST /api/undo`: undo the board's last transaction; with an empty log nothing changes. */
export const postUndo = action(s.object({}), () => {
  board.undo();
  return ok(null);
});
