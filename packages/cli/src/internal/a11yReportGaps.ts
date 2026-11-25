import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";
import { a11yProjects } from "./a11yProjects.ts";
import { isPageRoute } from "./isPageRoute.ts";
import { makeDiag } from "./makeDiag.ts";

/**
 * One W1733 at `<project>/reports/a11y.json` (`reports/a11y.json` for `.`) per project with a page route and no
 * `reports/a11y.json` among `files` (k.ledger-items Run evidence): its a11y items are `none`.
 */
export function a11yReportGaps(files: readonly SourceFile[]): Diag[] {
  const paths = new Set(files.map((f) => f.path));
  return a11yProjects(files).flatMap(({ dir, entries }) => {
    const pages = entries.filter(isPageRoute).length;
    const path = `${dir}reports/a11y.json`;
    if (pages === 0 || paths.has(path)) return [];
    const what = `${pages} page ${pages === 1 ? "route" : "routes"}`;
    return [makeDiag("W1733", `no reports/a11y.json for ${what}; its a11y items are none`, { path, see: "k.ledger-items" })];
  });
}
