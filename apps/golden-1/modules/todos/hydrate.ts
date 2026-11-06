import { transaction } from "@keel/store";
import { BoardView } from "./BoardView.schema.ts";
import { view } from "./view.ts";

/** Replace the client's copy of the board with what the `api` deployable served. */
export const hydrate = transaction(view, "todos.hydrate", BoardView, (_state, data) => data);
