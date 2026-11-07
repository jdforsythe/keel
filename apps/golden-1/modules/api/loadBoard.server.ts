import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { canUndoOwn } from "@keel/server";
import { BoardView } from "../todos/BoardView.schema.ts";
import { board } from "./board.ts";

/** `GET /api/lists`: every list and todo, and whether `POST /api/undo` would undo this caller's last write. */
export const loadBoard = loader({ output: BoardView }, async () =>
  ok({ lists: board.get("lists"), todos: board.get("todos"), canUndo: canUndoOwn(board) }),
);
