import type { A11yEntry } from "../types/A11yEntry.ts";
import type { Artifacts } from "../types/Artifacts.ts";
import type { DepsEdge } from "../types/DepsEdge.ts";
import type { DepsNode } from "../types/DepsNode.ts";
import type { IdEntry } from "../types/IdEntry.ts";

const cmp = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

/**
 * Union of per-module artifacts (as `compile` returns for one module each), sorted like `compile`'s
 * own output. Parts are taken in the given order; an element id claimed by an earlier part is kept
 * and reported in `duplicates` with the file of the later claim.
 */
export function mergeArtifacts(parts: readonly Artifacts[]): {
  artifacts: Artifacts;
  duplicates: { id: string; file: string }[];
} {
  const ids = new Map<string, IdEntry>();
  const a11y = new Map<string, A11yEntry>();
  const nodes = new Map<string, DepsNode>();
  const edges = new Map<string, DepsEdge>();
  const duplicates: { id: string; file: string }[] = [];
  for (const p of parts) {
    for (const id of Object.keys(p["ids.json"])) {
      const entry = p["ids.json"][id];
      const a = p["a11y.json"][id];
      if (entry === undefined) continue;
      if (ids.has(id)) {
        duplicates.push({ id, file: entry.file });
        continue;
      }
      ids.set(id, entry);
      if (a !== undefined) a11y.set(id, a);
    }
    for (const n of p["deps.json"].nodes) nodes.set(n.id, n);
    for (const e of p["deps.json"].edges) edges.set(`${e.from}\u0000${e.to}`, e);
  }
  const record = <T>(m: Map<string, T>): Record<string, T> => {
    const out: Record<string, T> = Object.create(null);
    for (const k of [...m.keys()].sort(cmp)) {
      const v = m.get(k);
      if (v !== undefined) out[k] = v;
    }
    return out;
  };
  return {
    artifacts: {
      "a11y.json": record(a11y),
      "deps.json": {
        edges: [...edges.values()].sort((x, y) => cmp(x.from, y.from) || cmp(x.to, y.to)),
        nodes: [...nodes.values()].sort((x, y) => cmp(x.id, y.id)),
      },
      "ids.json": record(ids),
      "routes.json": {},
    },
    duplicates,
  };
}
