import { axeRuleList } from "../../unsafe/axeRuleList.ts";
import { WCAG_CRITERIA } from "./WCAG_CRITERIA.ts";

/** Keel's own codes and the criteria they check (k.a11y Claims). */
const KEEL: Readonly<Record<string, readonly string[]>> = {
  E1702: ["4.1.2"],
  E1802: ["1.1.1", "1.3.1", "2.4.4", "4.1.2"],
  E1804: ["1.4.3"],
  E1820: ["1.3.2", "2.4.3"],
  E1821: ["1.3.5"],
};
const TAG = /^wcag(\d)(\d)(\d{1,2})$/;
let axeMap: ReadonlyMap<string, readonly string[]> | undefined;

/**
 * The WCAG 2.2 A and AA criteria a rule maps to (k.a11y Claims): an axe-core rule by its `wcag<n>` tags (`wcag143`
 * is 1.4.3), E1702, E1802, E1804, E1820 and E1821 by Keel's map; any other rule maps to none. Criteria outside
 * `WCAG_CRITERIA` (4.1.1, removed in 2.2) are left out.
 */
export function criteriaOf(rule: string): readonly string[] {
  const keel = KEEL[rule];
  if (keel !== undefined) return keel;
  axeMap ??= new Map(
    axeRuleList().map((r) => [
      r.id,
      r.tags.flatMap((t) => {
        const m = TAG.exec(t);
        const c = m === null ? "" : `${m[1]}.${m[2]}.${m[3]}`;
        return WCAG_CRITERIA.includes(c) ? [c] : [];
      }),
    ]),
  );
  return axeMap.get(rule) ?? [];
}
