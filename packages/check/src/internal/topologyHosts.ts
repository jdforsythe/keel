import type { Topology } from "@keel/compiler";
import { hostLiteralProblems } from "@keel/compiler/hosting/hostLiteralProblems";
import { hostProblems } from "@keel/compiler/hosting/hostProblems";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { clip } from "./clip.ts";
import { lineCol } from "./lineCol.ts";

/**
 * E1566 (k.hosting Host): each bad `host` of `topology`, and each `host` in `source` that is not a string literal
 * (`hostProblems`, `hostLiteralProblems`), reported at `<dir>topology.ts` on the first
 * `host` after the deployable's name in `source` (its text) when found. No fix.
 */
export function topologyHosts(dir: string, topology: Topology, source = ""): Diagnostic[] {
  return [...hostLiteralProblems(source), ...hostProblems(topology)].map(([name, message]) => {
    const at = Math.max(0, source.search(new RegExp(`\\b${name}\\b`)));
    const host = source.slice(at).search(/\bhost\b/);
    const { line, col } = lineCol(source, host < 0 ? at : at + host);
    return {
      kind: "diag",
      code: "E1566",
      path: `${dir}topology.ts`,
      line,
      col,
      message: clip(message, 89),
      see: "k.hosting",
    };
  });
}
