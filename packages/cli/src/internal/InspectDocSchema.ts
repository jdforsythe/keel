import { s } from "@keel/schema";

/**
 * The parts of `GET /__keel/inspect` (k.cli Inspect) that `keel inspect` summarizes. Store `state` and the artifact
 * entries are not read, so they are declared only as objects. `sections` (inspector hooks, RFC 0042) is absent from
 * the plugin's document and read as `{}`; each is `{ doc, error }` (E1057 in the target) or `{ doc, value }`.
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
  sections: s
    .record(s.union([s.object({ doc: s.string(), error: s.string() }), s.object({ doc: s.string(), value: s.json() })]))
    .optional(),
});
