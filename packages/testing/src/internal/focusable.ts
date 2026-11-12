import { isHidden } from "./isHidden.ts";

const TAKES_FOCUS: ReadonlySet<string> = new Set(["button", "input", "select", "textarea", "summary"]);

/**
 * True when a user can focus `el`: not disabled, not hidden, and a `button`, `input` other than
 * `type="hidden"`, `select`, `textarea`, `summary`, an `a` or `area` with `href`, `contenteditable`, or with a
 * `tabindex`. Decided here because happy-dom focuses any element.
 */
export function focusable(el: Element): boolean {
  if (isHidden(el) || Reflect.get(el, "disabled") === true) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" && el.getAttribute("type")?.toLowerCase() === "hidden") return false;
  const editable = el.getAttribute("contenteditable");
  return (
    TAKES_FOCUS.has(tag) ||
    ((tag === "a" || tag === "area") && el.hasAttribute("href")) ||
    (editable !== null && editable !== "false") ||
    el.hasAttribute("tabindex")
  );
}
