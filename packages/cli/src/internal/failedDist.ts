import type { Topology } from "@keel/compiler";
import type { OutRecord } from "../types/OutRecord.ts";

/**
 * The `dist/<name>` folders a failed `keel build` leaves none of (k.api Rules): for each E1511, the deployable its
 * message names; for each E1510, the deployable serving the module of its entry (the id before the message's `:`, else
 * the `modules/<id>/` of its path), or every deployable when neither names a module one serves.
 */
export function failedDist(records: readonly OutRecord[], topology: Topology | undefined): string[] {
  const names = Object.keys(topology ?? {});
  const out = new Set<string>();
  for (const r of records) {
    if (r.kind !== "diag" || (r.code !== "E1510" && r.code !== "E1511")) continue;
    const message = typeof r.message === "string" ? r.message : "";
    const named =
      r.code === "E1511" ? / deployable ([a-z][a-z0-9-]*), which has no server/.exec(message)?.[1] : undefined;
    const fromId = /^([a-z][\w-]*)\.[^\s:]+:/.exec(message)?.[1];
    const fromPath = typeof r.path === "string" ? /(?:^|\/)modules\/([^/]+)\//.exec(r.path)?.[1] : undefined;
    const module = fromId ?? fromPath;
    const serving = names.filter((n) => module !== undefined && topology?.[n]?.modules.includes(module) === true);
    const hit = named !== undefined && names.includes(named) ? [named] : serving;
    for (const n of hit.length > 0 ? hit : names) out.add(`dist/${n}`);
  }
  return [...out].sort();
}
