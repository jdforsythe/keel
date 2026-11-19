import type { Violation } from "./Violation.ts";
import { where } from "./where.ts";

/** E1821 (k.a11y): a control carrying `data-k-pii` (k.privacy) without an `autocomplete` attribute. */
export function piiViolations(root: Element): Violation[] {
  return Array.from(root.querySelectorAll("input[data-k-pii], textarea[data-k-pii], select[data-k-pii]"))
    .filter((el) => !el.hasAttribute("autocomplete"))
    .map((el) => ({
      rule: "E1821",
      element: el.id,
      at: where(el),
      help: "holds personal data and has no autocomplete; add its purpose or off",
    }));
}
