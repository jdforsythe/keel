import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { A11Y_CODE_CRITERIA } from "./A11Y_CODE_CRITERIA.ts";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";
import { isRecord } from "./isRecord.ts";

/** The axe-core tags the harness runs (k.a11y Render checks), and the rule it adds; `color-contrast` is E1804's. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const EXTRA = "landmark-unique";
const REPLACED = "color-contrast";
/** A criterion tag: `wcag143` is 1.4.3, `wcag1410` is 1.4.10. */
const CRITERION = /^wcag(\d)(\d)(\d+)$/;

/** axe-core's rules as `@keel/testing` resolves it, `{ id, tags }` each; empty when it does not load. */
async function axeRules(): Promise<{ id: string; tags: string[] }[]> {
  try {
    const testing = fileURLToPath(import.meta.resolve("@keel/testing"));
    const mod: unknown = await import(pathToFileURL(createRequire(testing).resolve("axe-core")).href);
    const axe = isRecord(mod) && isRecord(mod.default) ? mod.default : mod;
    const getRules = isRecord(axe) ? axe.getRules : undefined;
    const rules: unknown = typeof getRules === "function" ? getRules() : [];
    if (!Array.isArray(rules)) return [];
    return rules.flatMap((r: unknown) =>
      isRecord(r) && typeof r.ruleId === "string" && Array.isArray(r.tags)
        ? [{ id: r.ruleId, tags: r.tags.filter((t: unknown): t is string => typeof t === "string") }]
        : [],
    );
  } catch {
    return [];
  }
}

const parts = (c: string): number[] => c.split(".").map(Number);
const byCriterion = (a: string, b: string): number => {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

/**
 * The rule map of k.a11y Claims: axe-core's `wcag` criterion tags of the rules the harness runs, plus the Keel codes
 * (`A11Y_CODE_CRITERIA`), keyed by criterion in WCAG order. axe-core is read from its own rule metadata; without it
 * the map holds the Keel codes only.
 */
export async function a11yRuleMap(): Promise<A11yCriteriaMap> {
  const map = new Map<string, { render: string[]; static: string[] }>();
  const at = (c: string): { render: string[]; static: string[] } => {
    const got = map.get(c) ?? { render: [], static: [] };
    map.set(c, got);
    return got;
  };
  for (const rule of await axeRules()) {
    if (rule.id === REPLACED || !(rule.id === EXTRA || rule.tags.some((t) => TAGS.includes(t)))) continue;
    for (const t of rule.tags) {
      const m = CRITERION.exec(t);
      if (m !== null) at(`${m[1]}.${m[2]}.${m[3]}`).render.push(rule.id);
    }
  }
  for (const { code, criteria, render } of A11Y_CODE_CRITERIA)
    for (const c of criteria) (render ? at(c).render : at(c).static).push(code);
  return new Map(
    [...map.keys()].sort(byCriterion).map((c) => {
      const v = at(c);
      return [c, { render: [...new Set(v.render)].sort(), static: [...new Set(v.static)].sort() }];
    }),
  );
}
