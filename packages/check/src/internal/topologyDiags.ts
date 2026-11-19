import type { Topology } from "@keel/compiler";
import { hostProblems } from "@keel/compiler/hosting/hostProblems";
import { topologyReadProblems } from "@keel/compiler/hosting/topologyReadProblems";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { clip } from "./clip.ts";
import { lineCol } from "./lineCol.ts";

/**
 * The `topology.ts` errors of `keel check`: each problem of `source` (its text, when given) the static read finds
 * (`topologyReadProblems`: E1552, or E1566 for a `host` that is not a string literal) and an E1566 (k.hosting Host)
 * per bad `host` of `topology` (`hostProblems`). Reported at `<dir>topology.ts`, on the deployable's key in `source`
 * when found, an E1566 on the `host` after it. No fix.
 */
export function topologyDiags(dir: string, topology: Topology, source?: string): Diagnostic[] {
  const text = source ?? "";
  return [
    ...(source === undefined ? [] : topologyReadProblems(source)),
    ...hostProblems(topology).map((p) => ["E1566", ...p]),
  ].map(([code = "", name = "", message = ""]) => {
    const at = name ? Math.max(0, text.search(new RegExp(`(?<![\\w$-])${name.replace(/\W/g, "\\$&")}\\W?\\s*:`))) : 0;
    const hosting = code === "E1566";
    const host = hosting ? text.slice(at).search(/\bhost\b/) : -1;
    const { line, col } = lineCol(text, host < 0 ? at : at + host);
    const see = hosting ? "k.hosting" : "k.topology";
    return { kind: "diag", code, path: `${dir}topology.ts`, line, col, message: clip(message, 89), see };
  });
}
