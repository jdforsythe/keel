import { isRecord } from "./isRecord.ts";

/**
 * `reports/a11y.json` (k.a11y Claims, `A11yRun[]`) read for the ledger: per run the route it rendered (absent for a
 * component render), the rules that ran, and the rules violated (an E1703 violation by its axe rule, any other by its
 * code). Entries that are not runs are skipped; text that is not JSON is no runs.
 */
export function a11yRuns(
  text: string | undefined,
): { readonly route: string | undefined; readonly rules: readonly string[]; readonly violated: readonly string[] }[] {
  let parsed: unknown;
  try {
    parsed = text === undefined ? [] : JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const strings = (xs: unknown): string[] =>
    Array.isArray(xs) ? xs.filter((x: unknown): x is string => typeof x === "string") : [];
  const ruleOf = (v: unknown): string[] => {
    if (typeof v === "string") return [v];
    if (!isRecord(v)) return [];
    if (typeof v.rule === "string") return [v.rule];
    return typeof v.code === "string" ? [v.code] : [];
  };
  return parsed.flatMap((r: unknown) =>
    isRecord(r) && Array.isArray(r.rules)
      ? [
          {
            route: typeof r.route === "string" ? r.route : undefined,
            rules: strings(r.rules),
            violated: Array.isArray(r.violations) ? r.violations.flatMap(ruleOf) : [],
          },
        ]
      : [],
  );
}
