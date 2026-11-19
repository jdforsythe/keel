import { endpoints } from "@keel/services";
import { BoardView } from "../api/BoardView.schema.ts";

/** The `api` route `digest.recount` reads: `api.lists` (in the `api` module's `public.routes`). */
export const board = endpoints({
  lists: { method: "GET", path: "/api/lists", output: BoardView },
});
