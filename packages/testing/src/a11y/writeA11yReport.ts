import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { A11yCheck } from "../internal/A11yCheck.ts";
import type { A11yCase } from "../types/A11yCase.ts";
import type { A11yRun } from "../types/A11yRun.ts";

const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;
const strOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";
const isViolation = (v: unknown): v is A11yRun["violations"][number] =>
  isRec(v) && typeof v.rule === "string" && typeof v.element === "string";
const isCheck = (v: unknown): v is A11yCheck =>
  isRec(v) &&
  strOrNull(v.route) &&
  strOrNull(v.component) &&
  Array.isArray(v.rules) &&
  v.rules.every((r: unknown) => typeof r === "string") &&
  Array.isArray(v.violations) &&
  v.violations.every(isViolation);

/**
 * Write `<root>/reports/a11y.json` (k.a11y Claims): one `A11yRun` per render check the harness recorded in a test's
 * `meta.a11y`, with that test's file, name and outcome; ordered by file, then test, then render. A malformed entry
 * is skipped. Returns the runs written.
 */
export function writeA11yReport(root: string, cases: readonly A11yCase[]): readonly A11yRun[] {
  const sorted = [...cases].sort((a, b) =>
    a.file === b.file ? (a.test < b.test ? -1 : a.test > b.test ? 1 : 0) : a.file < b.file ? -1 : 1,
  );
  const runs = sorted.flatMap(({ file, test, passed, meta }): A11yRun[] => {
    const list: unknown = isRec(meta) ? meta.a11y : undefined;
    if (!Array.isArray(list)) return [];
    return list.filter(isCheck).map((c) => ({
      route: c.route,
      component: c.component,
      rules: [...c.rules],
      violations: c.violations.map((v) => ({ rule: v.rule, element: v.element })),
      file,
      test,
      passed,
    }));
  });
  const dir = join(root, "reports");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a11y.json"), `${JSON.stringify(runs, null, 2)}\n`);
  return runs;
}
