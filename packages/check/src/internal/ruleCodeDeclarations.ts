import { clipMessage } from "@keel/schema/internal";
import { Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Checked } from "./Checked.ts";
import { isAppPath } from "./isAppPath.ts";
import { lineCol } from "./lineCol.ts";

/**
 * E1753 (k.check) on source: a `defineRule({ code })` literal outside E2xxx/W2xxx, or a code already defined
 * by another `defineRule` in the checked files (path order).
 */
export function ruleCodeDeclarations(files: readonly Checked[]): Diagnostic[] {
  const first = new Map<string, string>();
  const out: Diagnostic[] = [];
  const ordered = [...files].sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));
  for (const { file, parsed } of ordered) {
    if (!isAppPath(file.path)) continue;
    const hits: { code: string; at: number }[] = [];
    new Visitor({
      CallExpression: (n) => {
        const arg = n.arguments[0];
        if (n.callee.type !== "Identifier" || n.callee.name !== "defineRule" || arg?.type !== "ObjectExpression")
          return;
        for (const p of arg.properties) {
          if (p.type !== "Property" || p.computed || p.key.type !== "Identifier" || p.key.name !== "code") continue;
          if (p.value.type === "Literal" && typeof p.value.value === "string")
            hits.push({ code: p.value.value, at: p.value.start });
        }
      },
    }).visit(parsed.program);
    for (const h of hits.sort((x, y) => x.at - y.at)) {
      const { line, col } = lineCol(file.source, h.at);
      const prior = first.get(h.code);
      const code = clipMessage(h.code, 20);
      let message: string | null = null;
      if (!/^[EW]2\d{3}$/.test(h.code)) message = `rule code ${code} is outside E2xxx/W2xxx`;
      else if (prior !== undefined) message = `rule code ${code} already defined at ${prior.slice(-40)}`;
      if (prior === undefined) first.set(h.code, `${file.path}:${line}`);
      if (message !== null)
        out.push({ kind: "diag", code: "E1753", path: file.path, line, col, message, see: "k.check" });
    }
  }
  return out;
}
