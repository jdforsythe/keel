import { rt } from "./internal/rt.ts";

/**
 * Snapshot of the live dependency graph: every undisposed node in creation order, and one edge per
 * dependency (`from` is read by `to`). Read by the compiler's deps.json and the inspector.
 */
export function inspect(): {
  nodes: { id: number; kind: "signal" | "computed" | "effect" | "resource" | "scope" }[];
  edges: { from: number; to: number }[];
} {
  const nodes: { id: number; kind: "signal" | "computed" | "effect" | "resource" | "scope" }[] = [];
  const edges: { from: number; to: number }[] = [];
  for (const n of rt.nodes) {
    nodes.push({ id: n.id, kind: n.kind });
    for (const s of n.sources) if (rt.nodes.has(s)) edges.push({ from: s.id, to: n.id });
  }
  return { nodes, edges };
}
