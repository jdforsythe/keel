import type { Topology } from "@keel/compiler";
import type { OutRecord } from "../types/OutRecord.ts";

/**
 * The `dist/<name>` folders a failed `keel build` leaves none of (k.api Rules): for each E1510 or E1511, those of the
 * deployables serving the module of its entry (the id before the message's `:`, else the `modules/<id>/` of its
 * path). An entry no deployable serves, or a record naming no module, removes none.
 */
export function failedDist(records: readonly OutRecord[], topology: Topology | undefined): string[] {
  const out = new Set<string>();
  for (const r of records) {
    if (r.kind !== "diag" || (r.code !== "E1510" && r.code !== "E1511")) continue;
    const message = typeof r.message === "string" ? r.message : "";
    const fromId = /^([a-z][\w-]*)\.[^\s:]+:/.exec(message)?.[1];
    const fromPath = typeof r.path === "string" ? /(?:^|\/)modules\/([^/]+)\//.exec(r.path)?.[1] : undefined;
    const module = fromId ?? fromPath;
    if (module === undefined) continue;
    for (const [name, deployable] of Object.entries(topology ?? {}))
      if (deployable.modules.includes(module)) out.add(`dist/${name}`);
  }
  return [...out].sort();
}
