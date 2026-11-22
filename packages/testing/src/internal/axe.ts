import { axeSync } from "../../unsafe/axeSync.ts";
import { currentTestMeta } from "../../unsafe/currentTestMeta.ts";
import type { Violation } from "./Violation.ts";
import { axeRuleIds } from "./axeRuleIds.ts";
import { fail } from "./fail.ts";
import { pageRoots } from "./pageRoots.ts";
import { uaHidden } from "./uaHidden.ts";
import { where } from "./where.ts";

/** The root's place in its document, child indexes from `<html>`: two live harnesses differ, a disposed and a new one in its place do not. */
const pathOf = (root: Element): string => {
  const at: number[] = [];
  for (let n: Element | null = root; n?.parentElement != null; n = n.parentElement)
    at.push(Array.prototype.indexOf.call(n.parentElement.children, n));
  return at.join(".");
};

type Outcome = { readonly ran: readonly string[]; readonly violations: Violation[] };
const seen = new WeakMap<object, Map<string, Outcome>>();

/**
 * Everything axe-core reads from `doc` for one check: the markup, form control values and checked states (properties
 * the markup may not show), the focused element, and where the checked root sits.
 */
const stateOf = (doc: Document, root: Element, page: boolean): string => {
  const controls = Array.from(doc.querySelectorAll("input, textarea, select"), (el) =>
    el instanceof HTMLInputElement ? `${el.value}\u0000${String(el.checked)}` : String(Reflect.get(el, "value")),
  );
  return [String(page), pathOf(root), doc.documentElement.outerHTML, doc.activeElement?.id ?? "", ...controls].join(
    "\u0001",
  );
};

/**
 * axe-core over a render (k.a11y Render checks): a component `render` judges its container with element rules; a
 * `page` judges the whole document, document rules included, but the other open pages (`pageRoots`). Returns the rules run and one violation per element.
 * Within one test, a document in the same state as one already judged (a `properties` case renders equal trees)
 * reuses that verdict.
 */
export function axe(root: Element, page: boolean): Outcome {
  const doc = root.ownerDocument;
  uaHidden(doc);
  const test = currentTestMeta();
  const memo = test === undefined ? undefined : (seen.get(test) ?? new Map<string, Outcome>());
  if (test !== undefined && memo !== undefined) seen.set(test, memo);
  const key = memo === undefined ? "" : stateOf(doc, root, page);
  const hit = memo?.get(key);
  if (hit !== undefined) return hit;
  const others = page ? [...pageRoots].filter((r) => r !== root && r.isConnected) : [];
  const { ran, failed, broken } = axeSync(page ? doc : root, axeRuleIds(page), others);
  const [bad] = broken;
  if (bad !== undefined || ran.length === 0)
    throw fail(
      "E1703",
      bad === undefined
        ? "axe-core ran no rule; the render was not checked (axe-core 4.14.0 is pinned)"
        : `axe-core rule ${bad.rule} threw: ${bad.message.slice(0, 60)}; the render was not checked`,
      { broken },
    );
  const violations = failed.flatMap(({ rule, help, elements }) =>
    elements.map((el) => ({ rule, element: el.id, at: where(el), help })),
  );
  const outcome = { ran, violations };
  memo?.set(key, outcome);
  return outcome;
}
