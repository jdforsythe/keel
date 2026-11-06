import type { A11yEntry } from "./A11yEntry.ts";
import type { DepsGraph } from "./DepsGraph.ts";
import type { IdEntry } from "./IdEntry.ts";

/** The `.keel/` artifacts as data. Keys are sorted; the Vite plugin serializes and hashes them. */
export type Artifacts = {
  "a11y.json": Record<string, A11yEntry>;
  "deps.json": DepsGraph;
  "ids.json": Record<string, IdEntry>;
  "routes.json": Record<string, never>;
};
