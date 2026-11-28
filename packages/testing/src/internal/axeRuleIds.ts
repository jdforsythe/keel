import { DOCUMENT_RULES } from "./DOCUMENT_RULES.ts";
import { WCAG_TAGS } from "./WCAG_TAGS.ts";
import { axeRuleList } from "./axeRuleList.ts";

const memo = new Map<boolean, ReadonlySet<string>>();
/**
 * Rules that cannot reach a verdict under happy-dom, so they never run and their criteria are never claimed:
 * `label-content-name-mismatch` measures icon ligatures on a canvas 2D context, and `link-in-text-block` compares
 * computed colors; happy-dom has neither.
 */
const NO_DOM: ReadonlySet<string> = new Set(["label-content-name-mismatch", "link-in-text-block"]);

/**
 * The axe-core rules a render runs: every rule axe enables by default that carries a WCAG A or AA tag and is not
 * experimental, plus `landmark-unique`; `color-contrast` is replaced by the render contrast check (E1804), and a rule happy-dom cannot run is left out. A `page`
 * (`renderRoute`) also runs the document rules; a component render runs none of them.
 */
export function axeRuleIds(page: boolean): ReadonlySet<string> {
  const hit = memo.get(page);
  if (hit !== undefined) return hit;
  const ids = new Set<string>();
  for (const r of axeRuleList()) {
    const wcag = r.tags.some((t) => WCAG_TAGS.includes(t)) && r.enabled && !r.tags.includes("experimental");
    if (
      r.id === "color-contrast" ||
      NO_DOM.has(r.id) ||
      (DOCUMENT_RULES.has(r.id) ? !page : !wcag && r.id !== "landmark-unique")
    )
      continue;
    ids.add(r.id);
  }
  memo.set(page, ids);
  return ids;
}
