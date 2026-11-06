import { s } from "@keel/schema";
import { A11yEntry } from "./A11yEntry.schema.ts";
import { Graph } from "./Graph.schema.ts";
import { IdEntry } from "./IdEntry.schema.ts";
import { RouteEntry } from "./RouteEntry.schema.ts";
import { StoreView } from "./StoreView.schema.ts";

/** Loader data of `inspector.index`: the inspected `url` and its inspect document, stores as `StoreView`. */
export const Inspection = s.object({
  url: s.string(),
  live: s.boolean(),
  graph: Graph,
  stores: s.record(StoreView),
  ids: s.record(IdEntry),
  a11y: s.record(A11yEntry),
  routes: s.record(RouteEntry),
});
