import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { BoardView } from "../api/BoardView.schema.ts";

/**
 * The board read and undo of the golden-1 `api` deployable (it owns the data), resolved by the topology
 * (`todosApi`): `lists` answers the `api.lists` loader's value, `undo` the href its action returns (or none). Board
 * writes go through `boardOutbox` (`boardWrites`).
 */
export const todos = endpoints({
  lists: { method: "GET", path: "/api/lists", output: BoardView },
  undo: { method: "POST", path: "/api/undo", output: s.string().nullable() },
});
