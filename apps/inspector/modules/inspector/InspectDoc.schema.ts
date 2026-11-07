import { s } from "@keel/schema";
import { A11yEntry } from "./A11yEntry.schema.ts";
import { Graph } from "./Graph.schema.ts";
import { IdEntry } from "./IdEntry.schema.ts";
import { InspectSection } from "./InspectSection.schema.ts";
import { LogEntry } from "./LogEntry.schema.ts";
import { RouteEntry } from "./RouteEntry.schema.ts";

/**
 * `GET /__keel/inspect` as served (k.cli Inspect). A store's `state` is any JSON (`s.json()`); `loadInspect` turns it
 * into JSON text for `StoreView`. `sections` (inspector hooks) is absent from a client-only app's document.
 */
export const InspectDoc = s.object({
  live: s.boolean(),
  graph: Graph,
  stores: s.record(s.object({ state: s.json(), log: s.array(LogEntry) })),
  ids: s.record(IdEntry),
  a11y: s.record(A11yEntry),
  routes: s.record(RouteEntry),
  sections: s.record(InspectSection).optional(),
});
