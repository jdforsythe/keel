import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";
import { a11yProjects } from "./a11yProjects.ts";
import { isPageRoute } from "./isPageRoute.ts";
import { makeDiag } from "./makeDiag.ts";
import { routeChain } from "./routeChain.ts";

/**
 * W1731 (k.ledger Rules) per layout (`path: null`) of a project's `.keel/routes.json` that no page route's chain
 * holds, at that file, naming the layout: its markup is in no render check (k.a11y Claims).
 */
export function pagelessLayouts(files: readonly SourceFile[]): Diag[] {
  return a11yProjects(files).flatMap(({ dir, entries }) => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    const held = new Set(entries.filter(isPageRoute).flatMap((p) => routeChain(p, byId).map((e) => e.id)));
    return entries
      .filter((e) => e.path === null && !held.has(e.id))
      .map((e) =>
        makeDiag("W1731", `layout ${e.id} wraps no page route: no render check holds its markup`, {
          path: `${dir}.keel/routes.json`,
          line: 1,
          col: 1,
          see: "k.a11y",
        }),
      );
  });
}
