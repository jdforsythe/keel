import { endpoints } from "@keel/services";
import { SuggestionsReply } from "./SuggestionsReply.schema.ts";

/**
 * Endpoints of the golden-1 `api` deployable (`api.suggestions` in the `api` module's `public.routes`). The client is
 * `service({ module: 'api', schema: suggestions })`: the topology resolves where `api` runs.
 */
export const suggestions = endpoints({
  list: { method: "GET", path: "/api/suggestions", output: SuggestionsReply },
});
