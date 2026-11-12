import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { BoardView } from "./BoardView.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `GET /api/lists`: every list and todo, and whether `POST /api/undo` would undo this caller's last write. */
export const loadBoard = loader({ output: BoardView, stores: boardStores }, async ({ caller, stores }) => {
  const { board } = stores;
  const canUndo = board.log().at(-1)?.meta?.caller === caller;
  return ok({ lists: board.get("lists"), todos: board.get("todos"), canUndo });
});
