import { axeSync } from "../../unsafe/axeSync.ts";
import type { Violation } from "./Violation.ts";
import { axeRuleIds } from "./axeRuleIds.ts";
import { uaHidden } from "./uaHidden.ts";
import { where } from "./where.ts";

/**
 * axe-core over a render (k.a11y Render checks): a component `render` judges its container with element rules; a
 * `page` judges the whole document, document rules included. Returns the rules run and one violation per element.
 */
export function axe(
  root: Element,
  page: boolean,
): { readonly ran: readonly string[]; readonly violations: Violation[] } {
  uaHidden(root.ownerDocument);
  const { ran, failed } = axeSync(page ? root.ownerDocument : root, axeRuleIds(page));
  const violations = failed.flatMap(({ rule, help, elements }) =>
    elements.map((el) => ({ rule, element: el.id, at: where(el), help })),
  );
  return { ran, violations };
}
