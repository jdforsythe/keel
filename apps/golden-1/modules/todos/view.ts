import { store } from "@keel/store";
import { BoardView } from "../api/BoardView.schema.ts";

/** The board as the `api` deployable last served it. Changes only through `todos.hydrate` (`refreshView`, `live`). */
export const view = store(BoardView, { lists: [], todos: [], canUndo: false, head: 0 }, { id: "todos.view" });
