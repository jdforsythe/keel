import type { Violation } from "./Violation.ts";
import { where } from "./where.ts";

/** The element's role as written: the first token of its `role` attribute. */
const roleToken = (el: Element): string => (el.getAttribute("role") ?? "").trim().split(/\s+/)[0] ?? "";

/**
 * E1826 (k.a11y): each `role="status"` element under `root` that `before` (the elements the root held before a
 * `fire` or `settle()`) did not hold, whose parent element it did, holding text. A region inside a subtree inserted
 * whole has a new parent and is left out; an `alert` is announced when inserted and is left out.
 */
export function insertedStatus(root: Element, before: ReadonlySet<Element>): Violation[] {
  return Array.from(root.querySelectorAll("[role]"))
    .filter((el) => roleToken(el) === "status" && !before.has(el))
    .filter((el) => el.parentElement !== null && before.has(el.parentElement))
    .filter((el) => (el.textContent ?? "").trim() !== "")
    .map((el) => ({
      rule: "E1826",
      element: el.id,
      at: `${el.id === "" ? where(el) : el.id}:`,
      help: "a status region inserted holding text is not announced; render it empty first and change its children",
    }));
}
