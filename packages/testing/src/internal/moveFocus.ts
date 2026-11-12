import { fail } from "./fail.ts";
import { focusable } from "./focusable.ts";

/**
 * The `fire` action for `focus` or `blur`: `el.focus()` or `el.blur()`, so the DOM moves focus and dispatches
 * the focus events itself. E1719 when `focus` targets an element a user cannot focus, or `blur` one that does
 * not have focus; nothing moves.
 */
export function moveFocus(el: Element, type: "focus" | "blur"): () => void {
  const target = el instanceof HTMLElement || el instanceof SVGElement ? el : undefined;
  if (type === "focus" ? target === undefined || !focusable(el) : el.ownerDocument.activeElement !== el)
    throw fail("E1719", type === "focus" ? `${el.id} is not focusable` : `${el.id} does not have focus`, {
      id: el.id,
      type,
    });
  return () => (type === "focus" ? target?.focus() : target?.blur());
}
