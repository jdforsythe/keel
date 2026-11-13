import type { SourceFile } from "../types/SourceFile.ts";
import type { A11yClaim } from "./A11yClaim.ts";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";
import { a11yRuns } from "./a11yRuns.ts";
import { isRecord } from "./isRecord.ts";

const ROUTES = /(?:^|\/)\.keel\/routes\.json$/;

const routeIds = (source: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(source);
    const data = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : isRecord(parsed) ? parsed : {};
    return Object.keys(data).sort();
  } catch {
    return [];
  }
};

/**
 * The a11y claims of k.a11y Claims, pure over the files: for each route of each project's `.keel/routes.json` and each
 * criterion of `map`, `example` when that project's `reports/a11y.json` has a run of the route, every render rule mapped
 * to the criterion ran in its runs and none was violated; else `none`. A criterion only static codes map to stays
 * `none`: the ledger does not run `keel check`, so it claims nothing it did not see run.
 */
export function a11yClaims(files: readonly SourceFile[], map: A11yCriteriaMap): A11yClaim[] {
  const out: A11yClaim[] = [];
  for (const f of files.filter((x) => ROUTES.test(x.path))) {
    const dir = f.path.slice(0, f.path.length - ".keel/routes.json".length);
    const report = `${dir}reports/a11y.json`;
    const runs = a11yRuns(files.find((x) => x.path === report)?.source);
    for (const route of routeIds(f.source)) {
      const mine = runs.filter((r) => r.route === route);
      const ran = new Set(mine.flatMap((r) => r.rules));
      const violated = new Set(mine.flatMap((r) => r.violated));
      for (const [criterion, rules] of map) {
        const held =
          mine.length > 0 && rules.render.length > 0 && rules.render.every((r) => ran.has(r) && !violated.has(r));
        out.push({
          item: `a11y:${route}#${criterion}`,
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
