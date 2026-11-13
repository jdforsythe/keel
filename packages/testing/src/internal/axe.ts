import { axeSync } from "../../unsafe/axeSync.ts";
import { currentTestMeta } from "../../unsafe/currentTestMeta.ts";
import type { Violation } from "./Violation.ts";
import { axeRuleIds } from "./axeRuleIds.ts";
import { uaHidden } from "./uaHidden.ts";
import { where } from "./where.ts";

type Outcome = { readonly ran: readonly string[]; readonly violations: Violation[] };
const seen = new WeakMap<object, Map<string, Outcome>>();

/**
 * Everything axe-core reads from `doc` for one check: the markup, form control values and checked states (properties
 * the markup may not show), and the focused element.
 */
const stateOf = (doc: Document, page: boolean): string => {
  const controls = Array.from(doc.querySelectorAll("input, textarea, select"), (el) =>
    el instanceof HTMLInputElement ? `${el.value}\u0000${String(el.checked)}` : String(Reflect.get(el, "value")),
  );
  return [String(page), doc.documentElement.outerHTML, doc.activeElement?.id ?? "", ...controls].join("\u0001");
};

/**
 * axe-core over a render (k.a11y Render checks): a component `render` judges its container with element rules; a
 * `page` judges the whole document, document rules included. Returns the rules run and one violation per element.
 * Within one test, a document in the same state as one already judged (a `properties` case renders equal trees)
 * reuses that verdict.
 */
export function axe(root: Element, page: boolean): Outcome {
  const doc = root.ownerDocument;
  uaHidden(doc);
  const test = currentTestMeta();
  const memo = test === undefined ? undefined : (seen.get(test) ?? new Map<string, Outcome>());
  if (test !== undefined && memo !== undefined) seen.set(test, memo);
  const key = memo === undefined ? "" : stateOf(doc, page);
  const hit = memo?.get(key);
  if (hit !== undefined) return hit;
  const { ran, failed } = axeSync(page ? doc : root, axeRuleIds(page));
  const violations = failed.flatMap(({ rule, help, elements }) =>
    elements.map((el) => ({ rule, element: el.id, at: where(el), help })),
  );
  const outcome = { ran, violations };
  memo?.set(key, outcome);
  return outcome;
}
