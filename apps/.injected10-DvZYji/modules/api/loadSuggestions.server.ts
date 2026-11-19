import { loader } from "@keel/router";
import { ok, s } from "@keel/schema";
import { Suggestion } from "./Suggestion.schema.ts";

const TITLES = ["Bread", "Eggs", "Milk"];

/** Suggested todo titles for `GET /api/suggestions`, sorted by title; the same list on every request. */
export const loadSuggestions = loader({ output: s.array(Suggestion) }, async () =>
  ok([...TITLES].sort().map((title) => ({ title }))),
);
