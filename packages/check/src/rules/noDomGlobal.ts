import { references } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const DOM_GLOBALS: ReadonlySet<string> = new Set(["document", "window"]);
/** Members E1601 already reports as ambient effects (`window.setTimeout`, `document.cookie`): not E1252 too. */
const AMBIENT_MEMBERS: ReadonlySet<string> = new Set([
  "Date",
  "Math",
  "performance",
  "crypto",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "cookie",
]);

/**
 * E1252 (k.runtime): a read of the global `document` or `window` in app code (the generated entry lives in
 * `.keel/`, outside app code). Names the file declares are skipped; members E1601 owns are left to it. No fix:
 * the JSX or `ctx` replacement is the author's.
 */
export const noDomGlobal: RuleDef = {
  code: "E1252",
  message: (f) => `${str(f.data, "name")} in app code; render with JSX and base elements, effects via ctx`,
  see: "k.runtime",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const { refs, declared } = references(ast);
    const ambient = new Set<number>();
    new Visitor({
      MemberExpression: (n) => {
        if (n.computed || n.object.type !== "Identifier" || !DOM_GLOBALS.has(n.object.name)) return;
        if (AMBIENT_MEMBERS.has(n.property.name)) ambient.add(n.object.start);
      },
    }).visit(ast);
    const out: Finding[] = [];
    for (const r of refs) {
      if (DOM_GLOBALS.has(r.name) && !declared.has(r.name) && !ambient.has(r.start))
        out.push(findingAt(file, r.start, { name: r.name }));
    }
    return out;
  },
};
