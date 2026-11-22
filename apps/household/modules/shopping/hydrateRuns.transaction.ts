import { transaction } from "@keel/store";
import { Runs } from "./Runs.schema.ts";
import { runsCopy } from "./runsCopy.store.ts";

/** Replaces the page's copy of the weekly runs with what the server answered. */
export const hydrateRuns = transaction(runsCopy, "shopping.runsCopy.hydrate", Runs, (_state, p) => ({
  runs: p,
  read: true,
}));
