import type { Infer } from "@keel/schema";
import { WCAG_CRITERIA } from "@keel/testing/a11y";
import type { A11yReport } from "../evidence/A11yReport.ts";
import type { A11yClaim } from "./A11yClaim.ts";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";
import { isRecord } from "./isRecord.ts";
import { keelModule } from "./keelModule.ts";
import { projectFileModule } from "./projectFileModule.ts";

type Report = Infer<typeof A11yReport>;
type Row = Report["contrast"][number];

const isRow = (r: unknown): r is Row =>
  isRecord(r) &&
  (r.scheme === "light" || r.scheme === "dark") &&
  typeof r.fg === "string" &&
  typeof r.bg === "string" &&
  typeof r.ratio === "number";

/**
 * Binary only: `a11y.json` (k.evidence, k.a11y Claims): each claim with the rules mapped to its criterion (render and
 * static), the WCAG 2.2 A and AA criteria no rule maps to (`WCAG_CRITERIA` of `@keel/testing/a11y`), for a person, and `contrastTable(tokens)` of `@keel/ui` over the project's `tokens.ts` (empty without one).
 */
export async function a11yReport(
  cwd: string,
  claims: readonly A11yClaim[],
  map: A11yCriteriaMap,
  hasTokens: boolean,
): Promise<Report> {
  const rulesOf = (c: string): string[] => {
    const m = map.get(c);
    return m === undefined ? [] : [...m.render, ...m.static].sort();
  };
  const ui = hasTokens ? await keelModule(cwd, "@keel/ui") : undefined;
  const mod = hasTokens ? await projectFileModule(cwd, "tokens.ts") : undefined;
  const tokens = mod?.tokens ?? mod?.default;
  const table = ui?.contrastTable;
  const rows: unknown = typeof table === "function" && tokens !== undefined ? table(tokens) : [];
  return {
    v: 1,
    claims: claims.map((c) => ({ route: c.route, criterion: c.criterion, rung: c.rung, rules: rulesOf(c.criterion) })),
    person: WCAG_CRITERIA.filter((c) => !map.has(c)),
    contrast: Array.isArray(rows) ? rows.filter(isRow) : [],
  };
}
