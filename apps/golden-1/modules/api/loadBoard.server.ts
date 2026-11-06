import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { BoardView } from "../todos/BoardView.schema.ts";
import { board } from "./board.ts";

/** `GET /api/lists`: every list and todo, and whether `POST /api/undo` has a transaction to undo. */
export const loadBoard = loader(BoardView, async () =>
  ok({ lists: board.get("lists"), todos: board.get("todos"), canUndo: board.log().length > 0 }),
);
