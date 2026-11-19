import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { BoardView } from "../api/BoardView.schema.ts";
import { Nothing } from "../api/Nothing.schema.ts";

/**
 * The board read and undo of the golden-1 `api` deployable (it owns the data), resolved by the topology
 * (`todosApi`): `lists` answers the `api.lists` loader's value, `undo` an empty object;
 * `removeList` hides a list and starts its removal, `undoRemoval` undoes one still waiting. Board writes go through
 * `boardOutbox` (`boardWrites`).
 */
export const todos = endpoints({
  lists: { method: "GET", path: "/api/lists", output: BoardView },
  undo: { method: "POST", path: "/api/undo", output: Nothing },
  removeList: {
    method: "POST",
    path: "/api/lists/:listId/remove",
    params: s.object({ listId: s.id("TodoList") }),
    output: Nothing,
  },
  undoRemoval: {
    method: "POST",
    path: "/api/removals/:flow/undo",
    params: s.object({ flow: s.string({ min: 1 }) }),
    output: Nothing,
  },
});
