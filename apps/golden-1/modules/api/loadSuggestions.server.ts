import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { api } from "./api.contract.ts";

const TITLES = ["Bread", "Eggs", "Milk"];

/** Suggested todo titles for `GET /api/suggestions`, sorted by title; the same list on every request. */
export const loadSuggestions = loader(api, "api.suggestions", {}, async () =>
  ok([...TITLES].sort().map((title) => ({ title }))),
);
