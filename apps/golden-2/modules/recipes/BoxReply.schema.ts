import { s } from "@keel/schema";
import { Box } from "./Box.schema.ts";

/** The whole runtime body of GET /api/recipes (k.server). */
export const BoxReply = s.object({
  id: s.string(),
  results: s.object({ "kitchen.recipes": s.object({ ok: s.literal(true), value: Box }) }),
});

export type BoxReply = s.infer<typeof BoxReply>;
