import type { Topology } from "@keel/compiler";
import { servedByProblems } from "@keel/compiler/hosting/servedByProblems";
import { topologyReadProblems } from "@keel/compiler/hosting/topologyReadProblems";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { applyEdits } from "./applyEdits.ts";
import { clip } from "./clip.ts";
import { lineCol } from "./lineCol.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const SEE = new Map([
  ["E1566", "k.hosting"],
  ["E1578", "k.user"],
  ["E1590", "k.origins"],
  ["E1591", "k.origins"],
]);

/**
 * The `topology.ts` errors of `keel check`: each problem of `source` (its text, when given) the static read finds
 * (`topologyReadProblems`: E1552, E1566 for a `servedBy` that is not a string literal, E1578 for a `caller`, E1590 and
 * E1591 for `origins`) and an E1566 (k.hosting Served by) per bad `servedBy` of `topology` (`servedByProblems`). Reported at
 * `<dir>topology.ts`: at the problem's offset when it has one, else on the deployable's key in `source` when found, an
 * E1566 on the `servedBy` after it. The fix is the problem's own replacement, when it has one.
 */
export function topologyDiags(dir: string, topology: Topology, source?: string): Diagnostic[] {
  const text = source ?? "";
  return [
    ...(source === undefined ? [] : topologyReadProblems(source)),
    ...servedByProblems(topology).map((p) => ["E1566", ...p]),
  ].map(([code = "", name = "", message = "", offset, edit]): Diagnostic => {
    const at = name ? Math.max(0, text.search(new RegExp(`(?<![\\w$-])${name.replace(/\W/g, "\\$&")}\\W?\\s*:`))) : 0;
    const hosting = code === "E1566";
    const by = hosting ? text.slice(at).search(/\bservedBy\b/) : -1;
    const { line, col } = lineCol(text, typeof offset === "number" ? offset : by < 0 ? at : at + by);
    const see = SEE.get(code) ?? "k.topology";
    const path = `${dir}topology.ts`;
    const diag: Diagnostic = { kind: "diag", code, path, line, col, message: clip(message, 89), see };
    return typeof edit === "object" ? { ...diag, fix: unifiedDiff(path, text, applyEdits(text, [edit])) } : diag;
  });
}
