import type { SourceFile } from "../types/SourceFile.ts";
import type { A11yClaim } from "./A11yClaim.ts";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";
import { a11yProjects } from "./a11yProjects.ts";
import { a11yRuns } from "./a11yRuns.ts";
import { isPageRoute } from "./isPageRoute.ts";
import { routeChain } from "./routeChain.ts";

/**
 * The a11y claims of k.a11y Claims, pure over the files: for each page route (`isPageRoute`) of each project's
 * `.keel/routes.json` and each criterion of `map`, the item `a11y:<project>:<routeId>#<criterion>`. Its rung is
 * `example` when at least one render rule maps to the criterion, every such rule is in the `rules` of some run a
 * passing test's render of the route made in that project's `reports/a11y.json`, none is in any of those runs'
 * violations, and `findings` (the static a11y codes, `a11yFindings`) hold none of the criterion's static codes under
 * `modules/<module>/` of an entry of the route's chain (`routeChain`: the page and the layouts that wrap it); else
 * `none`. Layouts and API entries have no item. A project with no `reports/a11y.json` on disk keeps the rung
 * `committed` holds for an item of this form (`kept`); an item `committed` does not hold, or a project whose report
 * is present, is computed. Committed items of any other form are not read, so a written ledger drops them.
 */
export function a11yClaims(
  files: readonly SourceFile[],
  map: A11yCriteriaMap,
  findings: readonly { readonly code: string; readonly path: string }[] = [],
  committed: ReadonlyMap<string, "none" | "example"> = new Map(),
): A11yClaim[] {
  const out: A11yClaim[] = [];
  for (const { project, dir, entries } of a11yProjects(files)) {
    const report = `${dir}reports/a11y.json`;
    const reportFile = files.find((x) => x.path === report);
    const runs = a11yRuns(reportFile?.source);
    const byId = new Map(entries.map((e) => [e.id, e]));
    for (const page of entries.filter(isPageRoute)) {
      const route = page.id;
      const mine = runs.filter((r) => r.route === route);
      const folders = [...new Set(routeChain(page, byId).map((e) => `${dir}modules/${e.module}/`))];
      const found = new Set(findings.filter((x) => folders.some((f) => x.path.startsWith(f))).map((x) => x.code));
      const ran = new Set(mine.flatMap((r) => r.rules));
      const violated = new Set(mine.flatMap((r) => r.violated));
      for (const [criterion, rules] of map) {
        const held =
          mine.length > 0 &&
          rules.render.length > 0 &&
          rules.render.every((r) => ran.has(r) && !violated.has(r)) &&
          !rules.static.some((c) => found.has(c));
        const item = `a11y:${project}:${route}#${criterion}`;
        const was = reportFile === undefined ? committed.get(item) : undefined;
        const rung = was ?? (held ? "example" : "none");
        const kept: { readonly kept?: true } = was === undefined ? {} : { kept: true };
        out.push({
          item,
          project,
          route,
          criterion,
          rung,
          evidence: rung === "example" ? `example ${report}` : "none",
          ...kept,
        });
      }
    }
  }
  return out;
}
