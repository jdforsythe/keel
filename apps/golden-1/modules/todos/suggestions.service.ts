import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { Suggestion } from "../api/Suggestion.schema.ts";

/**
 * Endpoints of the golden-1 `api` deployable (`api.suggestions` in the `api` module's `public.routes`). The client is
 * `service({ module: 'api', schema: suggestions })`: the topology resolves where `api` runs.
 */
export const suggestions = endpoints({
  list: { method: "GET", path: "/api/suggestions", output: s.array(Suggestion) },
});
