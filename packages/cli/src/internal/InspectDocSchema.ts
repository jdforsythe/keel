import { s } from "@keel/schema";

/**
 * The parts of `GET /__keel/inspect` (k.cli Inspect) that `keel inspect` summarizes. Store `state` and the artifact
 * entries are not read, so they are declared only as objects.
 */
export const InspectDocSchema = s.object({
  live: s.boolean(),
  graph: s.object({
    nodes: s.array(s.object({ id: s.int(), kind: s.string() })),
    edges: s.array(s.object({ from: s.int(), to: s.int() })),
  }),
  stores: s.record(s.object({ log: s.array(s.object({ name: s.string() })) })),
  ids: s.record(s.object({})),
  a11y: s.record(s.object({})),
  routes: s.record(s.object({})),
});
