import { a11yRules, criteriaOf } from "@keel/testing/a11y";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";

/** The Keel codes `keel check` reports (k.a11y Claims); E1804 and E1820 also run at render, so they are render rules too. */
const STATIC = ["E1802", "E1804", "E1820"];

/**
 * The rule map of k.a11y Claims, keyed by criterion in WCAG order: each render rule (`a11yRules` of `@keel/testing`)
 * and static code under the criteria `criteriaOf` maps it to.
 */
export function a11yRuleMap(): A11yCriteriaMap {
  const map = new Map<string, { render: string[]; static: string[] }>();
  const add = (rule: string, side: "render" | "static"): void => {
    for (const c of criteriaOf(rule)) {
      const got = map.get(c) ?? { render: [], static: [] };
      got[side].push(rule);
      map.set(c, got);
    }
  };
  for (const r of a11yRules()) add(r, "render");
  for (const r of STATIC) add(r, "static");
  const key = (c: string): number[] => c.split(".").map(Number);
  const order = (a: string, b: string): number => {
    const [x, y] = [key(a), key(b)];
    for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
  };
  return new Map(
    [...map.keys()].sort(order).map((c) => {
      const v = map.get(c) ?? { render: [], static: [] };
      return [c, { render: [...new Set(v.render)].sort(), static: [...new Set(v.static)].sort() }];
    }),
  );
}
