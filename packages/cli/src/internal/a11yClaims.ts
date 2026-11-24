import type { SourceFile } from "../types/SourceFile.ts";
import type { A11yClaim } from "./A11yClaim.ts";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";
import { a11yRuns } from "./a11yRuns.ts";
import { isRecord } from "./isRecord.ts";

const ROUTES = /(?:^|\/)\.keel\/routes\.json$/;

/** Each route id of a `routes.json` artifact with the module that declares it. */
const routesOf = (source: string): { id: string; module: string | undefined }[] => {
  try {
    const parsed: unknown = JSON.parse(source);
    const data = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : isRecord(parsed) ? parsed : {};
    return Object.keys(data)
      .sort()
      .map((id) => {
        const entry = data[id];
        return { id, module: isRecord(entry) && typeof entry.module === "string" ? entry.module : undefined };
      });
  } catch {
    return [];
  }
};

/**
 * The a11y claims of k.a11y Claims, pure over the files: for each route of each project's `.keel/routes.json` and each
 * criterion of `map`, `example` when that project's `reports/a11y.json` has a passing test's run of the route, every
 * render rule mapped to the criterion ran in those runs and none was violated, and `findings` (the static a11y codes,
 * `a11yFindings`) hold none of the criterion's static codes in the route's module (`<project>modules/<module>/`, its
 * components); else `none`. A criterion only static codes map to stays `none`: no render rule ran for it.
 * A project with no `reports/a11y.json` on disk keeps the rung `committed` holds for an item (`kept`); an item
 * `committed` does not hold, or a project whose report is present, is computed.
 */
export function a11yClaims(
  files: readonly SourceFile[],
  map: A11yCriteriaMap,
  findings: readonly { readonly code: string; readonly path: string }[] = [],
  committed: ReadonlyMap<string, "none" | "example"> = new Map(),
): A11yClaim[] {
  const out: A11yClaim[] = [];
  for (const f of files.filter((x) => ROUTES.test(x.path))) {
    const dir = f.path.slice(0, f.path.length - ".keel/routes.json".length);
    const report = `${dir}reports/a11y.json`;
    const reportFile = files.find((x) => x.path === report);
    const runs = a11yRuns(reportFile?.source);
    for (const { id: route, module } of routesOf(f.source)) {
      const mine = runs.filter((r) => r.route === route);
      const found = new Set(
        findings
          .filter((x) => module !== undefined && x.path.startsWith(`${dir}modules/${module}/`))
          .map((x) => x.code),
      );
      const ran = new Set(mine.flatMap((r) => r.rules));
      const violated = new Set(mine.flatMap((r) => r.violated));
      for (const [criterion, rules] of map) {
        const held =
          mine.length > 0 &&
          rules.render.length > 0 &&
          rules.render.every((r) => ran.has(r) && !violated.has(r)) &&
          !rules.static.some((c) => found.has(c));
        const item = `a11y:${route}#${criterion}`;
        const was = reportFile === undefined ? committed.get(item) : undefined;
        if (was !== undefined) {
          out.push({
            item,
            route,
            criterion,
            rung: was,
            evidence: was === "example" ? `example ${report}` : "none",
            kept: true,
          });
          continue;
        }
        out.push({
          item,
          route,
          criterion,
          rung: held ? "example" : "none",
          evidence: held ? `example ${report}` : "none",
        });
      }
    }
  }
  return out;
}
