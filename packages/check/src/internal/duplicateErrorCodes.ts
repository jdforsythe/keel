import { clip } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Checked } from "./Checked.ts";
import { isAppPath } from "./isAppPath.ts";
import { lineCol } from "./lineCol.ts";

/** E1454 (k.errors): a second `s.error(code, ...)` declaration with a code already declared (files in path order). */
export function duplicateErrorCodes(files: readonly Checked[]): Diagnostic[] {
  const first = new Map<string, string>();
  const out: Diagnostic[] = [];
  const ordered = [...files].sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));
  for (const { file, parsed } of ordered) {
    if (!isAppPath(file.path)) continue;
    const hits: { code: string; at: number }[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        const a = n.arguments[0];
        if (c.type !== "MemberExpression" || c.computed || c.property.name !== "error") return;
        if (c.object.type !== "Identifier" || c.object.name !== "s") return;
        if (a?.type === "Literal" && typeof a.value === "string") hits.push({ code: a.value, at: a.start });
      },
    }).visit(parsed.program);
    for (const h of hits.sort((x, y) => x.at - y.at)) {
      const { line, col } = lineCol(file.source, h.at);
      const prior = first.get(h.code);
      if (prior === undefined) {
        first.set(h.code, `${file.path}:${line}`);
        continue;
      }
      const message = clip(`error code "${clip(h.code, 30)}" already declared at ${prior.slice(-40)}`, 89);
      out.push({ kind: "diag", code: "E1454", path: file.path, line, col, message, see: "k.errors" });
    }
  }
  return out;
}
