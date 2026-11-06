import { endpoints } from "@keel/services";
import { SuggestionsReply } from "./SuggestionsReply.schema.ts";

/**
 * Endpoints of the golden-1 `api` deployable, served from the page's origin (vite proxies `/api`). The client is
 * built at call time with `service({ base: location.origin, schema: suggestions })`: `location` does not exist
 * when the compiler evaluates the route manifests in Node.
 */
export const suggestions = endpoints({
  list: { method: "GET", path: "/api/suggestions", output: SuggestionsReply },
});
