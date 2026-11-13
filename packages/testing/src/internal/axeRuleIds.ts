import { axeRuleList } from "../../unsafe/axeRuleList.ts";
import { DOCUMENT_RULES } from "./DOCUMENT_RULES.ts";
import { WCAG_TAGS } from "./WCAG_TAGS.ts";

const memo = new Map<boolean, ReadonlySet<string>>();

/**
 * The axe-core rules a render runs: every rule axe enables by default that carries a WCAG A or AA tag and is not
 * experimental, plus `landmark-unique`; `color-contrast` is replaced by the render contrast check (E1804). A `page`
 * (`renderRoute`) also runs the document rules; a component render runs none of them.
 */
export function axeRuleIds(page: boolean): ReadonlySet<string> {
  const hit = memo.get(page);
  if (hit !== undefined) return hit;
  const ids = new Set<string>();
  for (const r of axeRuleList()) {
    const wcag = r.tags.some((t) => WCAG_TAGS.includes(t)) && r.enabled && !r.tags.includes("experimental");
    if (r.id === "color-contrast" || (DOCUMENT_RULES.has(r.id) ? !page : !wcag && r.id !== "landmark-unique")) continue;
    ids.add(r.id);
  }
  memo.set(page, ids);
  return ids;
}
