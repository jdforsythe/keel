import { type Program, Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { UiSite } from "./UiSite.ts";
import { uiElementSites } from "./uiElementSites.ts";

/**
 * The uses of `@keel/ui`'s `target` in `file`: with the type pass on, the elements and calls at the offsets the checker
 * resolved to it (`typed`: imports, re-exports, namespace members, aliases); without it, the ones `uiElementSites` reads
 * from the source text.
 */
export function uiSitesOf(
  file: SourceFile,
  ast: Program,
  project: readonly SourceFile[],
  target: string,
  typed: ReadonlySet<number> | undefined,
): UiSite[] {
  if (typed === undefined) return uiElementSites(file, ast, project, target);
  const out: UiSite[] = [];
  new Visitor({
    JSXOpeningElement: (n) => {
      if (typed.has(n.start)) out.push({ at: n.start, element: n });
    },
    CallExpression: (n) => {
      if (typed.has(n.callee.start)) out.push({ at: n.callee.start, element: undefined });
    },
  }).visit(ast);
  return out.sort((x, y) => x.at - y.at);
}
