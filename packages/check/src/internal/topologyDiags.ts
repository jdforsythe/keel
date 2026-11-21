import type { Topology } from "@keel/compiler";
import { hostProblems } from "@keel/compiler/hosting/hostProblems";
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
 * (`topologyReadProblems`: E1552, E1566 for a `host` that is not a string literal, E1578 for a `caller`, E1590 and
 * E1591 for `origins`) and an E1566 (k.hosting Host) per bad `host` of `topology` (`hostProblems`). Reported at
 * `<dir>topology.ts`: at the problem's offset when it has one, else on the deployable's key in `source` when found, an
 * E1566 on the `host` after it. The fix is the problem's own replacement, when it has one.
 */
export function topologyDiags(dir: string, topology: Topology, source?: string): Diagnostic[] {
  const text = source ?? "";
  return [
    ...(source === undefined ? [] : topologyReadProblems(source)),
    ...hostProblems(topology).map((p) => ["E1566", ...p]),
  ].map(([code = "", name = "", message = "", offset, edit]): Diagnostic => {
    const at = name ? Math.max(0, text.search(new RegExp(`(?<![\\w$-])${name.replace(/\W/g, "\\$&")}\\W?\\s*:`))) : 0;
    const hosting = code === "E1566";
    const host = hosting ? text.slice(at).search(/\bhost\b/) : -1;
    const { line, col } = lineCol(text, typeof offset === "number" ? offset : host < 0 ? at : at + host);
    const see = SEE.get(code) ?? "k.topology";
    const path = `${dir}topology.ts`;
    const diag: Diagnostic = { kind: "diag", code, path, line, col, message: clip(message, 89), see };
    return typeof edit === "object" ? { ...diag, fix: unifiedDiff(path, text, applyEdits(text, [edit])) } : diag;
  });
}
