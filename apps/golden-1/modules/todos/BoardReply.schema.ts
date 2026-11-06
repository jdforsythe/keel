import { s } from "@keel/schema";
import { BoardView } from "./BoardView.schema.ts";

/** The `api` deployable's runtime answer to `GET /api/lists` (k.server): the `api.lists` loader `Result`. */
export const BoardReply = s.object({
  id: s.literal("api.lists"),
  results: s.object({
    "api.lists": s.object({ ok: s.literal(true), value: BoardView }),
  }),
});
export type BoardReply = s.infer<typeof BoardReply>;
