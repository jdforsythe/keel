import { s } from "@keel/schema";
import { BoardView } from "../todos/BoardView.schema.ts";

/** The `api` module's runtime answer to `GET /api/lists` (k.server): the `api.lists` loader `Result`. */
export const ListsReply = s.object({
  id: s.literal("api.lists"),
  results: s.object({
    "api.lists": s.object({ ok: s.literal(true), value: BoardView }),
  }),
});
export type ListsReply = s.infer<typeof ListsReply>;
