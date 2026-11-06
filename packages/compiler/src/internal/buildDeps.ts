import type { DepsEdge } from "../types/DepsEdge.ts";
import type { DepsGraph } from "../types/DepsGraph.ts";
import type { DepsNode } from "../types/DepsNode.ts";
import type { Analysis } from "./Analysis.ts";
import type { BindingInfo } from "./BindingInfo.ts";
import type { Span } from "./Span.ts";
import { lineCol } from "./lineCol.ts";

/**
 * Static reactive graph (k.reactive artifacts), best effort by identifier name within a file: nodes are
 * `signal`/`computed`/`resource` declarations, `effect` calls, props fields and bindings (DOM bindings and
 * the tracked input of `cond`/`list`/`match`); an edge `from -> to` means `to` re-runs when `from` changes.
 * Event handlers are nodes without edges (they are not tracked). Shadowing is not resolved.
 */
export function buildDeps(files: readonly { a: Analysis; bindings: readonly BindingInfo[] }[]): DepsGraph {
  const nodes = new Map<string, DepsNode>();
  const edges = new Map<string, DepsEdge>();
  const edge = (from: string, to: string): void => void edges.set(`${from}\u0000${to}`, { from, to });
  for (const { a, bindings } of files) {
    const decl = new Map<string, string>();
    for (const r of a.reactive) {
      const id = `${a.path}#${r.name}`;
      decl.set(r.name, id);
      nodes.set(id, { id, kind: r.kind, name: r.name, file: a.path });
    }
    const readsIn = (s: Span): string[] => {
      const out: string[] = [];
      for (const i of a.idents) {
        const id = decl.get(i.name);
        if (id !== undefined && i.start >= s.start && i.end <= s.end) out.push(id);
      }
      return out;
    };
    for (const r of a.reactive) {
      const to = `${a.path}#${r.name}`;
      for (const from of readsIn(r.init)) if (from !== to) edge(from, to);
    }
    for (const e of a.effects) {
      const { line, col } = lineCol(a.source, e.start);
      const id = `${a.path}#effect@${line}:${col}`;
      nodes.set(id, { id, kind: "effect", name: `effect@${line}:${col}`, file: a.path });
      for (const from of readsIn(e)) edge(from, id);
    }
    const seen = new Map<string, number>();
    for (const b of bindings) {
      const base = `${b.element}:${b.kind}:${b.name}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const id = n === 0 ? base : `${base}:${n}`;
      nodes.set(id, { id, kind: "binding", name: `${b.kind} ${b.name}`, file: a.path });
      if (b.kind === "on") continue;
      for (const r of b.reads) {
        const from = decl.get(r);
        if (from !== undefined) edge(from, id);
      }
      for (const p of b.props) {
        const pid = `${a.path}#props.${p}`;
        nodes.set(pid, { id: pid, kind: "prop", name: p, file: a.path });
        edge(pid, id);
      }
    }
  }
  const byId = (x: DepsNode, y: DepsNode): number => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  const byEdge = (x: DepsEdge, y: DepsEdge): number =>
    x.from < y.from ? -1 : x.from > y.from ? 1 : x.to < y.to ? -1 : x.to > y.to ? 1 : 0;
  return { edges: [...edges.values()].sort(byEdge), nodes: [...nodes.values()].sort(byId) };
}
