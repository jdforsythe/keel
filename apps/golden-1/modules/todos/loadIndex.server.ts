import { loader } from "@keel/router";
import { BoardView } from "./BoardView.schema.ts";
import { refreshView } from "./refreshView.ts";

/** Loader of `todos.index`: the board from the `api` deployable, hydrated into `todos.view`. */
export const loadIndex = loader(BoardView, async (_at, ctx) => refreshView(ctx));
