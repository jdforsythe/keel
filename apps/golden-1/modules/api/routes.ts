import { manifest } from "@keel/router";
import SuggestionsApi from "./SuggestionsApi.ts";
import { loadSuggestions } from "./loadSuggestions.server.ts";

export const routes = manifest({
  "api.suggestions": { path: "/api/suggestions", loader: loadSuggestions, component: SuggestionsApi },
});
