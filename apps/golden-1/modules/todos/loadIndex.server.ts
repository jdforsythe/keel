import { loader } from "@keel/router";
import { BoardView } from "../api/BoardView.schema.ts";
import { refreshView } from "./refreshView.ts";

/** Loader of `todos.index`: the board from the `api` deployable, hydrated into `todos.view`. */
export const loadIndex = loader({ output: BoardView }, async (_, ctx) => refreshView(ctx));
