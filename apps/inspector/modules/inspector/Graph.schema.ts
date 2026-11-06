import { s } from "@keel/schema";

/** The live dependency graph, `inspect()` of k.reactive: nodes by id and kind, `from` is read by `to`. */
export const Graph = s.object({
  nodes: s.array(s.object({ id: s.int(), kind: s.enum(["scope", "signal", "computed", "effect", "resource"]) })),
  edges: s.array(s.object({ from: s.int(), to: s.int() })),
});
