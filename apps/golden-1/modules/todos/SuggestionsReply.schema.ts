import { s } from "@keel/schema";
import { Suggestion } from "./Suggestion.schema.ts";

/** The `api` deployable's runtime answer to `GET /api/suggestions` (k.server): the `api.suggestions` loader `Result`. */
export const SuggestionsReply = s.object({
  id: s.literal("api.suggestions"),
  results: s.object({
    "api.suggestions": s.object({ ok: s.literal(true), value: s.array(Suggestion) }),
  }),
});
export type SuggestionsReply = s.infer<typeof SuggestionsReply>;
