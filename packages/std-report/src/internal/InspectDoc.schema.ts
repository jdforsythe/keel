import { s } from "@keel/schema";

/** The parts of `GET /__keel/inspect` (k.inspect) that mark an inspect document; `sections` is absent without inspector hooks. */
export const InspectDoc = s.object({
  live: s.boolean(),
  graph: s.object({}),
  stores: s.record(s.json()),
  ids: s.record(s.json()),
  a11y: s.record(s.json()),
  routes: s.record(s.json()),
  sections: s.record(s.json()).optional(),
});
