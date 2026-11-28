import { isRecord } from "./isRecord.ts";

/**
 * `reports/a11y.json` (`A11yRun[]` of `@keel/testing/a11y`, k.a11y Claims) read for the ledger: per route render of a
 * passing test, the rules that ran and the rules violated. Component renders, runs of failing tests and entries that
 * are not runs are skipped; text that is not JSON is no runs.
 */
export function a11yRuns(
  text: string | undefined,
): { readonly route: string; readonly rules: readonly string[]; readonly violated: readonly string[] }[] {
  let parsed: unknown;
  try {
    parsed = text === undefined ? [] : JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const strings = (xs: unknown): string[] =>
    Array.isArray(xs) ? xs.filter((x: unknown): x is string => typeof x === "string") : [];
  const ruleOf = (v: unknown): string[] => (isRecord(v) && typeof v.rule === "string" ? [v.rule] : []);
  return parsed.flatMap((r: unknown) =>
    isRecord(r) && typeof r.route === "string" && r.passed === true && Array.isArray(r.rules)
      ? [
          {
            route: r.route,
            rules: strings(r.rules),
            violated: Array.isArray(r.violations) ? r.violations.flatMap(ruleOf) : [],
          },
        ]
      : [],
  );
}
