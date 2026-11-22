import { axeRuleIds } from "../internal/axeRuleIds.ts";

/**
 * Every rule a `renderRoute` render check can run, sorted (k.a11y Render checks): the axe-core rules (WCAG A and
 * AA tags, `landmark-unique` and the document rules, `color-contrast` excluded), E1702, E1804, E1820 and E1821. A claim
 * needs each of them that maps to its criterion (`criteriaOf`) in a passing run's `rules`.
 */
export function a11yRules(): readonly string[] {
  return [...axeRuleIds(true), "E1702", "E1804", "E1820", "E1821"].sort();
}
