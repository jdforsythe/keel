import type { Diagnostic } from "../../types/Diagnostic.ts";
import { stemOf } from "../stemOf.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { moduleDiag } from "./moduleDiag.ts";

/**
 * Sorted, distinct deps of a module that name a discovered (non-opaque) module; a library's entries that do not begin
 * with `@` name no module (E1163).
 */
function edges(m: ModuleInfo, byKey: ReadonlyMap<string, ModuleInfo>): string[] {
  const ds =
    m.manifest?.deps.entries
      .map((e) => e.value)
      .filter((k) => (!m.library || k.startsWith("@")) && (byKey.get(k)?.manifest ?? null) !== null) ?? [];
  return [...new Set(ds)].sort();
}

/** Keys reachable from `from` in one or more steps. */
function reach(from: string, graph: ReadonlyMap<string, readonly string[]>): Set<string> {
  const seen = new Set<string>();
  const queue = [...(graph.get(from) ?? [])];
  for (let k = queue.shift(); k !== undefined; k = queue.shift()) {
    if (seen.has(k)) continue;
    seen.add(k);
    queue.push(...(graph.get(k) ?? []));
  }
  return seen;
}

/** Shortest cycle `start -> ... -> start` inside `scc` (breadth first, deps in sorted order). */
function cycleFrom(start: string, scc: ReadonlySet<string>, graph: ReadonlyMap<string, readonly string[]>): string[] {
  const parent = new Map<string, string>();
  const queue = [start];
  for (let k = queue.shift(); k !== undefined; k = queue.shift()) {
    for (const n of graph.get(k) ?? []) {
      if (n === start) {
        const path = [start];
        for (let p: string | undefined = k; p !== undefined && p !== start; p = parent.get(p)) path.splice(1, 0, p);
        return [...path, start];
      }
      if (!scc.has(n) || parent.has(n)) continue;
      parent.set(n, k);
      queue.push(n);
    }
  }
  return [start, start];
}

/**
 * E1153: one diagnostic per cycle in module `deps` (per strongly connected component), at the manifest of the
 * component's smallest module id, on the dep that starts the reported cycle; the message lists the cycle. When an edge
 * of that cycle imports a `*.guard.*` file (`guards`), the first such edge's first file by path names the guard.
 */
export function depsCycles(
  modules: readonly ModuleInfo[],
  byKey: ReadonlyMap<string, ModuleInfo>,
  guards: ReadonlyMap<string, readonly string[]> = new Map(),
): Diagnostic[] {
  const graph = new Map(modules.map((m) => [m.key, edges(m, byKey)]));
  const done = new Set<string>();
  const out: Diagnostic[] = [];
  for (const m of modules) {
    if (done.has(m.key)) continue;
    const r = reach(m.key, graph);
    if (!r.has(m.key)) continue;
    const scc = new Set([...r].filter((k) => reach(k, graph).has(m.key)));
    for (const k of scc) done.add(k);
    const cycle = cycleFrom(m.key, scc, graph);
    const at = m.manifest?.deps.entries.find((e) => e.value === cycle[1])?.start ?? 0;
    const ids = cycle.join(" -> ");
    const guard = cycle.slice(1).flatMap((to, i) => guards.get(`${cycle[i]}\n${to}`)?.slice(0, 1) ?? [])[0];
    out.push(
      guard === undefined
        ? moduleDiag("E1153", m.file, at, `module deps cycle: ${ids}`)
        : moduleDiag(
            "E1153",
            m.file,
            at,
            `module deps cycle through guard ${stemOf(guard)}: ${ids}`,
            undefined,
            "k.guards",
          ),
    );
  }
  return out;
}
