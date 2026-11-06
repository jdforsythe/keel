import type { DepsEdge } from "./DepsEdge.ts";
import type { DepsNode } from "./DepsNode.ts";

/** `deps.json`: nodes sorted by id, edges sorted by (from, to). */
export type DepsGraph = { edges: DepsEdge[]; nodes: DepsNode[] };
